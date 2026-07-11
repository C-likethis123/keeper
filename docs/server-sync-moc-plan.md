# Server Sync and MOC Classification Plan

## Goal

Move Keeper toward a server-backed sync model where:

- clients stay offline-first
- server persists note operations
- server syncs canonical note state to Git
- server runs MOC classification
- clients fetch cluster suggestions and submit feedback

Git becomes export, backup, and history. Server database becomes source of truth.

## Hosting Choice

Use Oracle Free Tier first.

Oracle works better than Vercel for this experiment because the server needs:

- long-running workers
- local git checkout
- Python embedding/classification jobs
- persistent disk/cache
- Redis queue
- Postgres database

Vercel can work later as a thin API layer, but it is a poor fit for git + MOC workers.

## Proposed Stack

### API

- Node.js
- TypeScript
- Fastify
- Zod or Fastify JSON schemas
- Drizzle ORM
- PostgreSQL

### Jobs

- BullMQ
- Redis
- separate worker process

### Git

- simple-git or shell `git`
- one server-side clone of notes repo
- deploy key or GitHub PAT
- serialized git sync job

### MOC

- Python worker
- reuse `scripts/moc_pipeline`
- sentence-transformers
- numpy
- scikit-learn
- pyyaml

### Deployment

- Docker Compose
- Caddy or nginx
- systemd for Docker service restart

## Server Layout

```txt
server/
  api/
    src/
      index.ts
      routes/
        sync.ts
        notes.ts
        clusters.ts
        jobs.ts
      db/
        client.ts
        schema.ts
        migrations/
      jobs/
        queue.ts
        types.ts
  worker/
    src/
      index.ts
      gitWorker.ts
      mocWorker.ts
  python/
    moc_runner.py
  docker-compose.yml
  Dockerfile.api
  Dockerfile.worker
  README.md
```

## Data Model

### Notes

```sql
notes (
  id text primary key,
  path text not null unique,
  title text not null,
  markdown text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  version bigint not null default 0
)
```

Use stable note IDs. Do not use path as identity. Path can change.

### Devices

```sql
devices (
  id text primary key,
  name text,
  created_at timestamptz not null
)
```

### Sync Operations

```sql
sync_ops (
  id bigserial primary key,
  op_id text not null unique,
  device_id text not null references devices(id),
  device_seq bigint not null,
  type text not null,
  note_id text not null,
  payload jsonb not null,
  created_at timestamptz not null,
  unique(device_id, device_seq)
)
```

Operation types:

- `note.create`
- `note.update`
- `note.rename`
- `note.delete`

### Clusters

```sql
clusters (
  id text primary key,
  name text not null,
  confidence real not null,
  status text not null default 'pending',
  parent_id text,
  created_at timestamptz not null,
  accepted_at timestamptz,
  dismissed_at timestamptz
)
```

```sql
cluster_members (
  cluster_id text not null references clusters(id) on delete cascade,
  note_id text not null references notes(id),
  score real not null,
  primary key (cluster_id, note_id)
)
```

```sql
cluster_feedback (
  id bigserial primary key,
  cluster_id text not null,
  event_type text not null,
  event_data jsonb not null,
  created_at timestamptz not null
)
```

### Jobs

```sql
jobs (
  id text primary key,
  type text not null,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  error text
)
```

## Sync API

### Push Operations

```http
POST /sync/push
```

Request:

```json
{
  "deviceId": "macbook",
  "ops": [
    {
      "opId": "macbook:42",
      "seq": 42,
      "type": "note.create",
      "noteId": "note-abc",
      "path": "notes/note-abc.md",
      "title": "Inbox",
      "markdown": "# Inbox",
      "createdAt": "2026-07-11T10:00:00Z"
    }
  ]
}
```

Response:

```json
{
  "accepted": ["macbook:42"],
  "cursor": 109
}
```

Rules:

- idempotent by `opId`
- reject duplicate `(deviceId, seq)` with different payload
- apply operations in device sequence order
- enqueue `git-sync` after accepted operations
- enqueue `moc-classify` after git sync succeeds

### Pull Operations

```http
GET /sync/pull?cursor=108
```

Response:

```json
{
  "cursor": 109,
  "ops": [
    {
      "serverId": 109,
      "type": "note.delete",
      "noteId": "note-abc",
      "deletedAt": "2026-07-11T10:00:00Z"
    }
  ]
}
```

Rules:

- clients store last server cursor locally
- deleted notes are soft-deleted first
- physical deletion can happen later

## Notes API

Notes API reads current server state. Sync API moves changes.

```http
GET /notes
GET /notes/:id
GET /notes/:id/snapshot
```

Use this for initial bootstrap, repair, and debugging.

## Cluster API

```http
GET /clusters
GET /clusters/:id/members
POST /clusters/:id/accept
POST /clusters/:id/dismiss
POST /clusters/:id/rename
POST /clusters/:id/feedback
POST /clusters/:id/members
DELETE /clusters/:id/members/:noteId
```

Cluster rows reference `note_id`, not file path.

## Git Worker

Input:

- current rows from `notes`
- pending dirty note IDs

Flow:

1. acquire Redis git lock
2. pull latest Git repo
3. materialize live notes to markdown files
4. remove files for soft-deleted notes
5. commit changes
6. push to GitHub
7. record commit SHA
8. release lock
9. enqueue MOC classification

Important:

- only server pushes to Git
- clients stop direct Git pushes once server sync is stable
- server handles conflicts centrally

## MOC Worker

Input:

- live notes where `deleted_at is null`
- cluster feedback
- latest git commit SHA

Flow:

1. export live notes to temp notes root
2. export feedback to expected pipeline format
3. run current MOC pipeline
4. import clusters and members into Postgres
5. preserve accepted/dismissed cluster state where possible
6. mark job done

## Client Changes

Add server sync beside current local persistence.

Initial client service:

```txt
src/services/sync/
  remoteSyncClient.ts
  syncOpQueue.ts
  syncPullService.ts
  syncPushService.ts
```

Client behavior:

- write local note first
- append local sync op
- push ops in background
- pull remote ops on startup and resume
- apply pulled ops to local storage/index
- keep Git path unchanged during early experiment

## Phases

### Phase 0: Server Skeleton

Deliver:

- `server/` workspace
- Fastify API
- `/health`
- Docker Compose with API, Postgres, Redis
- Drizzle migrations

Success:

- server starts on Oracle VM
- migrations run
- `/health` returns OK

### Phase 1: Persist Operations

Deliver:

- `POST /sync/push`
- `sync_ops` table
- `notes` table
- operation validation
- idempotent writes

Success:

- create/update/delete ops persist
- duplicate ops are safe
- current note state updates correctly

### Phase 2: Client Push

Deliver:

- client local operation queue
- push service
- environment config for server URL
- retry/backoff

Success:

- creating note locally sends `note.create`
- editing note sends `note.update`
- deleting note sends `note.delete`
- app works offline and catches up later

### Phase 3: Pull and Multi-Device Sync

Deliver:

- `GET /sync/pull`
- local server cursor
- apply remote create/update/rename/delete
- conflict policy

Success:

- device A creates note
- device B pulls note
- device A deletes note
- device B removes note from active view

### Phase 4: Server Git Sync

Deliver:

- git worker
- Redis git lock
- repo clone on server
- commit and push flow
- job status endpoint

Success:

- pushed client ops become Git commits
- deleted notes are removed from Git
- only server writes to remote Git repo

### Phase 5: Server MOC Classification

Deliver:

- Python MOC runner
- MOC job worker
- cluster import into Postgres
- cluster API reads server clusters

Success:

- new notes trigger classification
- client sees suggestions from server
- accepted/dismissed feedback persists

### Phase 6: Cutover

Deliver:

- feature flag for server sync
- disable direct client Git push when enabled
- migration/repair docs
- observability logs

Success:

- normal app usage relies on server sync
- Git remains backup/export
- MOC output is server-generated

## Conflict Policy

Start simple:

- note creates with same ID are idempotent
- updates use last-write-wins by server operation order
- deletes win over older updates
- update after delete is rejected unless it includes explicit restore

Later:

- use Yjs update merge for editor content
- retain operation log for audit
- expose restore deleted note

## Security

Minimum:

- HTTPS
- bearer token auth
- per-user server for experiment
- GitHub token only on server
- never ship GitHub write token to clients

Later:

- proper users table
- device registration
- scoped access tokens
- encrypted note storage option

## Open Questions

- One user only, or multi-user from start?
- Store Markdown snapshots only, or raw Yjs updates too?
- Keep current CRDT files in Git, or make server DB canonical?
- How long keep deleted notes before purge?
- Should MOC run after every commit or on a debounce schedule?

## Recommended First Implementation

Build single-user server.

Start with Markdown snapshots plus operation log. Keep Yjs local until sync transport is stable. Add raw Yjs update sync after create/update/delete lifecycle is proven.
