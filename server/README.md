# Keeper Server

Server sync API for persisted note operations.

## Run Locally

```bash
cd server
docker compose up
```

API stays private on the Docker network. Use the HTTPS proxy from the host:

```bash
curl -k https://localhost/health
```

For temporary self-signed HTTPS, set the VM IP or host:

```bash
KEEPER_API_DOMAIN=161.118.229.1
```

Then restart:

```bash
docker compose up -d
docker compose logs -f caddy
```

Do not open inbound TCP `80` or `443` in the VM cloud firewall/security list.
Caddy binds to the Oracle loopback interface only for local health checks and
proxies to the API container on `8787`.

Export the Caddy root cert if a client needs to trust it:

```bash
docker compose cp caddy:/data/keeper-self-signed.crt ./keeper-caddy-root.crt
```

For direct public ingress only, use a real DNS name and switch `Caddyfile` back
to managed TLS so Caddy can get a public Let's Encrypt certificate.

For Git and MOC workers, set:

```bash
SERVER_GIT_REMOTE_URL=<C-likethis123/logseq git-remote-url>
SERVER_GIT_REPO_DIR=/data/repos/keeper-notes
REDIS_URL=redis://redis:6379
KEEPER_SEED_TOKEN=<shared-token-for-github-action>
```

Server request hardening accepts these optional settings:

```bash
KEEPER_CORS_ALLOWED_ORIGINS=https://keeper.pages.dev,tauri://localhost,http://tauri.localhost,http://localhost:8082
KEEPER_SYNC_BODY_LIMIT_BYTES=16777216
KEEPER_RATE_LIMIT_MAX=120
KEEPER_RATE_LIMIT_WINDOW_MS=60000
```

Origins must be exact origins without paths. Omit `http://localhost:8082` in
production unless browser UI is intentionally served from that origin. Requests
without an `Origin` header, including native app requests, remain allowed.
When `tauri://localhost` or `http://localhost:8082` is allowed, Keeper also
accepts Tauri's random `http://localhost:<port>` production origin.

Git worker derives GitHub owner and repository from `SERVER_GIT_REMOTE_URL`.
Remote may contain existing HTTPS GitHub credentials. Git worker reuses embedded
password/token for GraphQL commits. Set `SERVER_GITHUB_TOKEN` when remote URL uses
SSH or contains no credentials.

Push operation:

```bash
curl -k -X POST https://localhost/sync/push \
  -H 'content-type: application/json' \
  -d '{
    "deviceId": "macbook",
    "ops": [{
      "opId": "macbook:1",
      "seq": 1,
      "type": "note.create",
      "noteId": "note-1",
      "path": "notes/note-1.md",
      "title": "Inbox",
      "markdown": "# Inbox",
      "createdAt": "2026-07-11T10:00:00Z"
    }]
  }'
```

Pull operations after a server cursor:

```bash
curl -k 'https://localhost/sync/pull?deviceId=macbook&cursor=0'
```

Seed from the configured Logseq Git remote. Set `SERVER_GIT_REMOTE_URL` to the
`C-likethis123/logseq` remote (with credentials if it is private); do not point it
at the Keeper application repository.

```bash
curl -X POST https://localhost/github/seed \
  -H "authorization: Bearer $KEEPER_SEED_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "repository": "owner/repo",
    "ref": "main",
    "sha": "abc123",
    "proceedIfDbHasData": false
  }'
```

Client cutover flag:

```bash
EXPO_PUBLIC_SYNC_SERVER_URL=/api
```

For the private Pages proxy, set this in the Pages build environment. Native
builds need a separate direct API URL and are not covered by this web-only path.
When the sync server URL is set, clients keep local writes and server sync
enabled but stop direct client Git journal writes.

## Private Cloudflare Worker proxy

To keep the Oracle API private while serving the web app from the `keeper`
Cloudflare Worker, use the private Worker in `cloudflare/private-api-proxy/`.
The browser calls same-origin `/api/*`; only the Worker can reach Oracle through
the Tunnel. Follow
[`cloudflare/private-api-proxy/README.md`](../cloudflare/private-api-proxy/README.md).

Deploy the frontend with `npm run deploy:web:cloudflare`, which sets
`EXPO_PUBLIC_SYNC_SERVER_URL=/api`. This setting is web-only; do not use it in a
native app build.

## Optional Cloudflare Access

This is only for a separate public API hostname. The private Pages proxy uses
`KEEPER_PRIVATE_PROXY_TOKEN` instead and does not require an Access application.
If enabled, the API verifies Cloudflare's signed `Cf-Access-Jwt-Assertion`
header before serving sync, cluster, or job routes.

The Compose stack runs `cloudflared` as a container. Add this repository secret
before deploying:

```bash
gh secret set CLOUDFLARE_TUNNEL_TOKEN --repo OWNER/REPO --body 'eyJ...'
```

Set both values to enable Access verification:

```bash
CLOUDFLARE_ACCESS_TEAM_DOMAIN=https://your-team.cloudflareaccess.com
CLOUDFLARE_ACCESS_AUD=your-access-application-audience
```

Do not create a published tunnel route when using the private Pages proxy.

## Implemented Scope

- `/health`
- `POST /sync/push`
- `GET /sync/pull`
- `devices`, `notes`, `sync_ops`
- idempotent operation insert
- create, update, rename, delete note state
- per-client pull cursor support
- same-device operations are skipped during pull while the cursor still advances
- `git.sync` worker reads canonical notes from Postgres and creates GitHub commits through GraphQL
- GitHub commits use expected branch head OIDs and retry concurrent branch updates
- Redis `git.sync` jobs retry with exponential backoff
- Redis-backed Git lock when `REDIS_URL` is set
- `POST /github/seed` seeds markdown notes from the configured GitHub repo
- `/jobs` and `/jobs/:id`
- `moc.classify` worker runs the Python pipeline and imports clusters
- `/clusters/active`, `/clusters/accepted`, `/clusters/:id/members`
- cluster accept/dismiss/rename/feedback routes

Cutover notes live in `../docs/server-sync-cutover.md`.
