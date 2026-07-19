# Server Sync Cutover

## Enable

Set client env:

```bash
EXPO_PUBLIC_SERVER_SYNC_ENABLED=true
EXPO_PUBLIC_SYNC_SERVER_URL=https://keeper-sync.example
```

Set server env:

```bash
DATABASE_URL=postgres://keeper:keeper@postgres:5432/keeper
REDIS_URL=redis://redis:6379
SERVER_GIT_REMOTE_URL=<C-likethis/logseq git-remote-url>
SERVER_GIT_REPO_DIR=/data/repos/keeper-notes
SERVER_GIT_BRANCH=main
KEEPER_SEED_TOKEN=<shared-token-for-github-action>
MOC_PIPELINE_PATH=/app/scripts/moc_pipeline/pipeline.py
PYTHON_BIN=python3
```

Set GitHub Action secrets:

```bash
KEEPER_API_DOMAIN=keeper-sync.example
KEEPER_SEED_TOKEN=<same-token-as-server>
SERVER_GIT_REMOTE_URL=<C-likethis/logseq git-remote-url>
```

## Migration

1. Pick one current device as source of truth.
2. Let that device finish local Git push.
3. Point `SERVER_GIT_REMOTE_URL` at the `C-likethis/logseq` remote.
4. Start server and run migrations.
5. Run the `Seed Server` GitHub Action with `empty-only`.
6. Confirm `/sync/pull?deviceId=check&cursor=0` returns seed operations.
7. Start client with `EXPO_PUBLIC_SERVER_SYNC_ENABLED=true`.
8. Create or edit one low-risk note.
9. Confirm `/jobs?kind=git.sync` shows succeeded.
10. Confirm remote Git has server commit.
11. Enable same flag on other devices.

## Repair

- If a client misses notes, clear `keeper:sync:pull-cursor` from client storage and restart app.
- If Git job fails, inspect `/jobs?kind=git.sync`, fix env/remote access, then edit one note to enqueue a fresh `git.sync` job. The failed job keeps its error for audit.

- If MOC output is stale, post:

```bash
curl -X POST "$SERVER/jobs" \
  -H 'content-type: application/json' \
  -d '{"kind":"moc.classify","input":{}}'
```

## Checks

- `/health` returns `{ "ok": true }`.
- `/sync/pull?deviceId=check&cursor=0` returns server cursor.
- `/clusters/active` returns server-generated suggestions.
- Server logs include `[JobQueue]` status lines.
