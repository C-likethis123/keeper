# Cloudflare Access Authentication

> Status: implemented for deployed web sync.

Cloudflare Access authenticates browser. Keeper stores no app bearer token.

## Route policy

| Routes | Authentication |
| --- | --- |
| `/health` | Public |
| `OPTIONS` | Public CORS preflight |
| `/sync/*` | Valid Cloudflare Access JWT |
| `/clusters/*` | Valid Cloudflare Access JWT |
| `/jobs/*` | Valid Cloudflare Access JWT |
| `/github/seed` | Separate `KEEPER_SEED_TOKEN` only |

## Server

`server/api/src/auth/cloudflareAccess.ts` verifies `Cf-Access-Jwt-Assertion` using Cloudflare remote JWKS. It checks issuer and Access application audience.

API startup requires:

```bash
CLOUDFLARE_ACCESS_TEAM_DOMAIN=https://your-team.cloudflareaccess.com
CLOUDFLARE_ACCESS_AUD=your-access-application-audience
```

Missing values stop API startup. JWT never logs or persists.

## Web client

Sync and cluster requests use `keeperApiFetch` with `credentials: "include"`. Browser sends HttpOnly Cloudflare Access cookie. No token enters `EXPO_PUBLIC_*` or JS bundle.

Prefer one deployed HTTPS origin: `https://keeper.example.com/api/*`. Separate API hostname needs same Access application and exact CORS origin.

## Deployment

1. Publish API only through Cloudflare Tunnel. No direct origin port.
2. Create Cloudflare Access self-hosted app covering web app and API hostname/path.
3. Add allow policy for intended users.
4. Put team domain and audience tag in deployment secrets.
5. Set `EXPO_PUBLIC_SYNC_SERVER_URL` to Cloudflare HTTPS hostname. Never origin IP.

Cloudflare forwards signed assertion header. Keeper verifies it again. Access bypass cannot reach protected routes.

## Verification

- Missing or invalid Access JWT: `403`.
- Valid Access JWT: protected route works.
- Health and CORS preflight stay public.
- GitHub seed needs separate token.
- Config rejects missing or non-HTTPS Access data.
