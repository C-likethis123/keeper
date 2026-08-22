  Best immediate model: single-user opaque bearer token. Fits current architecture. No login server needed.

  ## Route policy

   Routes          Authentication
  ━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━
   /health         Public
  ──────────────  ───────────────────────────
   OPTIONS         Public for CORS preflight
  ──────────────  ───────────────────────────
   /sync/*         User bearer token
  ──────────────  ───────────────────────────
   /clusters/*     User bearer token
  ──────────────  ───────────────────────────
   /jobs/*         Admin token or disabled
  ──────────────  ───────────────────────────
   /github/seed    Existing seed token only

  Client never uses /jobs. Disable production job routes if possible.

  ## Server token design

  Generate random 256-bit token. No human password.

  Store only SHA-256 hash on server:

  KEEPER_API_TOKEN_SHA256=<64-character-hex-hash>

  Client keeps original token.

  SHA-256 works here because source token has high random entropy. Human password would require Argon2id instead.

  Add server/api/src/auth/bearerAuth.ts:

  - Parse Authorization: Bearer <token>
  - Hash supplied token
  - Compare using crypto.timingSafeEqual
  - Return 401
  - Include:

  WWW-Authenticate: Bearer realm="keeper"

  - Never log token

  Register Fastify onRequest hook around protected routes. Fastify officially supports authentication through request hooks and encapsulated route groups: Fastify hooks
  (https://fastify.dev/docs/v5.0.x/Reference/Hooks/).

  Suggested structure:

  server.register(async (protectedServer) => {
        protectedServer.addHook("onRequest", authenticateApiToken);

        registerSyncRoutes(protectedServer, ...);
        registerClusterRoutes(protectedServer, ...);
  });

  Keep health and GitHub seed outside protected group. Encapsulation avoids fragile URL-based exclusions.

  Fail server startup when token hash missing. No accidental unauthenticated mode.

  ## Client changes

  Create central authenticated request wrapper:

  export async function keeperApiFetch(
        path: string,
        init: RequestInit = {},
  ): Promise<Response> {
        const token = await authTokenStore.getToken();
        if (!token) throw new AuthenticationRequiredError();

        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);

        return fetch(`${getSyncServerUrl()}${path}`, {
                ...init,
                headers,
        });
  }

  Use wrapper from:

  - src/services/sync/remoteSyncClient.ts
  - src/services/notes/serverClusterClient.ts

  Current clients call fetch independently. Central wrapper prevents missed routes.

  On 401:

  - Stop push/pull retry loops
  - Mark authentication invalid
  - Show “Reconnect server”
  - Preserve queued note changes
  - Do not retry every minute with bad token

  Startup currently starts sync immediately in src/hooks/useAppStartup.ts:92. Wait for token storage hydration first.

  ## Token storage

  Never use:

  EXPO_PUBLIC_SYNC_TOKEN

  Expo public variables enter application bundle. Anyone can extract token.

  Recommended storage:

  - Android/iOS: expo-secure-store
  - Tauri: Stronghold plugin, or prompt once each launch
  - Normal web browser: memory/session-only; prompt each launch
  - Never AsyncStorage or localStorage

  Expo confirms SecureStore uses encrypted Android/iOS storage and has no web equivalent: Expo authentication storage (https://docs.expo.dev/guides/authentication/).

  Tauri provides encrypted Stronghold storage: Tauri Stronghold (https://v2.tauri.app/plugin/stronghold/).

  Simplest first release:

  - Mobile: SecureStore persistence
  - Desktop/web: token prompt each launch
  - Later: Stronghold persistence

  native-data-fetching guidance favors central authenticated fetch wrapper plus secure native storage. Good fit here.

  ## Connection UI

  Add server connection form:

  Server URL
  Access token
  Connect

  Add protected endpoint:

  GET /auth/check

  Success:

  204 No Content

  Flow:

  1. User enters URL and token.
  2. Client calls /auth/check.
  3. Success stores token.
  4. Sync services start.
  5. Failure keeps token out of persistent storage.

  ## Deployment

  Update:

  - server/docker-compose.yml
  - .github/workflows/deploy-server.yml
  - server/api/src/index.ts
  - server/api/src/server.ts

  Pass hash:

  KEEPER_API_TOKEN_SHA256: ${KEEPER_API_TOKEN_SHA256:?required}

  Keep KEEPER_SEED_TOKEN separate. User token must not authorize GitHub seed. Seed token must not authorize sync.

  ## Rotation

  Support two hashes temporarily:

  KEEPER_API_TOKEN_SHA256
  KEEPER_API_PREVIOUS_TOKEN_SHA256

  Rotation:

  1. Deploy new hash plus old hash as previous.
  2. Update all devices.
  3. Remove previous hash.
  4. Redeploy.

  Longer-term: per-device tokens stored hashed in PostgreSQL. Allows revoking one lost device without changing every client.

  ## Required tests

  - Missing token returns 401.
  - Wrong token returns 401.
  - Valid token permits sync and clusters.
  - /health remains public.
  - CORS preflight works without token.
  - API token cannot call /github/seed.
  - Seed token cannot call /sync.
  - Previous rotation token works.
  - Authorization header never appears in logs.
  - Every client request includes bearer header.
  - 401 stops retry loop without discarding queued changes.

  TLS must verify normally before sending token. Never send bearer token through curl -k or untrusted certificate connection. OWASP requires HTTPS for REST credentials: OWASP REST
  security (https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html).
