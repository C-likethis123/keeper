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

For Git and MOC workers, set:

```bash
SERVER_GIT_REMOTE_URL=<git-remote-url>
SERVER_GIT_REPO_DIR=/data/keeper-notes
REDIS_URL=redis://redis:6379
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

Client cutover flag:

```bash
EXPO_PUBLIC_SERVER_SYNC_ENABLED=true
EXPO_PUBLIC_SYNC_SERVER_URL=http://localhost:8787
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
- `/jobs` and `/jobs/:id`
- `moc.classify` worker runs the Python pipeline and imports clusters
- `/clusters/active`, `/clusters/accepted`, `/clusters/:id/members`
- cluster accept/dismiss/rename/feedback routes

Cutover notes live in `../docs/server-sync-cutover.md`.
