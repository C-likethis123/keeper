# Keeper Server

Phase 1 server for persisted note operations.

## Run Locally

```bash
cd server
docker compose up
```

API:

```bash
curl http://localhost:8787/health
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

## Phase 1 Scope

- `/health`
- `POST /sync/push`
- `devices`, `notes`, `sync_ops`
- idempotent operation insert
- create, update, rename, delete note state

No pull API, jobs, Git worker, or MOC worker yet.
