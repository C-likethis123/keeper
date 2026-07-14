# Keeper Server

Server sync API for persisted note operations.

## Run Locally

```bash
cd server
docker compose up
```

API:

```bash
curl http://localhost:8787/health
```

Proxy:

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

Open inbound TCP `443` in the VM cloud firewall/security list. Caddy terminates HTTPS with a self-signed certificate and proxies to the API container on `8787`.

Export the Caddy root cert if a client needs to trust it:

```bash
docker compose cp caddy:/data/keeper-self-signed.crt ./keeper-caddy-root.crt
```

For production HTTPS, use a real DNS name and switch `Caddyfile` back to managed TLS so Caddy can get a public Let's Encrypt certificate.

For Git and MOC workers, set:

```bash
SERVER_GIT_REMOTE_URL=<git-remote-url>
SERVER_GIT_REPO_DIR=/data/keeper-notes
REDIS_URL=redis://redis:6379
KEEPER_SEED_TOKEN=<shared-token-for-github-action>
```

Push operation:

```bash
curl -X POST http://localhost:8787/sync/push \
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
curl 'http://localhost:8787/sync/pull?deviceId=macbook&cursor=0'
```

Seed from the configured GitHub repo:

```bash
curl -X POST http://localhost:8787/github/seed \
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
EXPO_PUBLIC_SERVER_SYNC_ENABLED=true
EXPO_PUBLIC_SYNC_SERVER_URL=https://161.118.229.1
```

When the flag is enabled, clients keep local writes and server sync enabled but stop direct client Git journal writes.

## Implemented Scope

- `/health`
- `POST /sync/push`
- `GET /sync/pull`
- `devices`, `notes`, `sync_ops`
- idempotent operation insert
- create, update, rename, delete note state
- per-client pull cursor support
- same-device operations are skipped during pull while the cursor still advances
- `git.sync` worker clones the server repo, writes accepted note ops, commits, and pushes
- Redis-backed Git lock when `REDIS_URL` is set
- `POST /github/seed` seeds markdown notes from the configured GitHub repo
- `/jobs` and `/jobs/:id`
- `moc.classify` worker runs the Python pipeline and imports clusters
- `/clusters/active`, `/clusters/accepted`, `/clusters/:id/members`
- cluster accept/dismiss/rename/feedback routes

Cutover notes live in `../docs/server-sync-cutover.md`.
