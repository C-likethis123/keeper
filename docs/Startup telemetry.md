# Startup telemetry

Keeper emits structured startup timing logs under the `[StartupTrace]` prefix so startup performance work can be measured without a dedicated telemetry backend.

## Where the logs come from

- `src/services/startup/startupStrategies.ts`
- `src/services/startup/startupSteps.ts`
- `src/services/startup/startupTelemetry.ts`
- `src/services/git/gitInitializationService.ts`
- `src/services/notes/notesIndexDb.ts`

## How to view them

- Desktop Tauri: run `npm run desktop` and watch the app or dev terminal output.
- Android dev build: run `npm run android:dev` and watch Metro output, or use `adb logcat` if you also want native-side context.
- iOS dev build: run `npm run ios` and watch the Expo or Xcode logs.

Search for `[StartupTrace]` to isolate the structured startup events.

## Log format

Each line uses a stable prefix plus a structured object:

```text
[StartupTrace] {
  runId: "startup-...",
  runtime: "desktop-tauri" | "mobile-native" | "unsupported",
  event: "...",
  timestampMs: 1234,
  ...
}
```

Important fields:

- `runId`: groups all startup events for one launch.
- `runtime`: shows which startup strategy ran. Early bootstrap markers use `runtime: "bootstrap"`.
- `event`: a lifecycle event like `startup_run_completed` or a step event.
- `timestampMs`: milliseconds since JS runtime start.
- `durationMs`: present on completed or failed steps.
- step-specific fields such as `success`, `needsRebuild`, `fetchMs`, `mergeMs`, `checkoutMs`, and `dbSyncMs`.

## Events to look for

Top-level lifecycle:

- `bootstrap.layout_module_evaluated`
- `bootstrap.root_layout_first_render`
- `bootstrap.use_app_startup_hook_entered`
- `bootstrap.use_app_startup_effect_started`
- `bootstrap.runtime_support_resolved`
- `bootstrap.run_startup_strategy_invoked`
- `startup_run_started`
- `startup_run_completed`
- `startup_run_failed`

Per-step markers:

- `step_started`
- `step_completed`
- `step_failed`

Common `step` values:

- `desktop.hydrate_ui`
- `mobile.hydrate_ui`
- `unsupported.hydrate_ui`
- `storage.initialize`
- `storage.index_rebuild_after_init`
- `git.initialize`
- `git.index_rebuild_after_clone`

Additional trace events:

- `git.fetch_completed`
- `git.resolve_head_before_sync_completed`
- `git.remote_branches_listed`
- `git.current_branch_resolved`
- `git.branch_resolution_completed`
- `git.branch_checkout_completed`
- `git.merge_fast_forward_failed`
- `git.merge_completed`
- `git.resolve_head_after_sync_completed`
- `git.last_synced_oid_read`
- `git.last_synced_oid_written`
- `git.changed_paths_computed`
- `git.changed_paths_fallback`
- `git.db_sync_completed`
- `git.db_sync_failed`
- `git.db_sync_skipped`
- `git.repository_validation`
- `git.clone_completed`
- `git.runtime_unsupported`
- `git.initialize_metrics`
- `git.unsupported_runtime`
- `runtime.unsupported_reason`
- `storage.read_only_mode`

## How to read a startup trace

1. Find a single `runId`.
2. Use the bootstrap events to measure the pre-startup gap before `startup_run_started`.
3. Check `startup_run_completed.totalMs` for the measured startup-strategy time only.
4. Compare `step_completed.durationMs` for `storage.initialize`, `git.initialize`, and any rebuild step.
5. For git-heavy launches, inspect the `git.initialize` payload:
   - `validateRepoMs`
   - `fetchMs`
   - `resolveHeadBeforeMs`
   - `resolveHeadAfterMs`
   - `branchResolveMs`
   - `remoteBranchListMs`
   - `currentBranchResolveMs`
   - `mergeMs`
   - `fastForwardMergeMs`
   - `regularMergeMs`
   - `checkoutMs`
   - `dbSyncMs`
   - `readLastSyncedOidMs`
   - `writeLastSyncedOidMs`
   - `changedPathsMs`
   - `indexSyncMs`
   - `didHeadChange`
   - `didDbSync`
   - `usedFastForward`
6. Inspect `git.db_sync_completed` to see:
   - `syncMode`: `incremental` or `full_rebuild`
   - `changedPathCount`
   - `markdownChangedPathCount`
   - `metrics.noteCount`, `metrics.readParseMs`, `metrics.sqlInsertMs`, `metrics.ftsRebuildMs`, or incremental sync metrics
7. Cross-check with `[notesIndexDb] rebuildFromDisk metrics` or `[notesIndexDb] syncChanges metrics` if indexing looks expensive.

To estimate true JS-side startup from first traced bootstrap event through startup completion:

- `startup_run_completed.timestampMs - bootstrap.layout_module_evaluated.timestampMs`

To estimate how much time passed before the startup strategy even began:

- `startup_run_started.timestampMs - bootstrap.layout_module_evaluated.timestampMs`

## What the numbers usually mean

- A large gap between `bootstrap.layout_module_evaluated` and `bootstrap.run_startup_strategy_invoked` means the missing time is in app/bootstrap/render/effect scheduling, not in git or storage startup steps.
- High `validateRepoMs`: repo validation or storage access is slow before sync starts.
- High `fetchMs`: network or remote negotiation is likely the bottleneck.
- High `mergeMs`: merge work is expensive.
- High `checkoutMs`: working tree checkout is a major startup cost.
- High `dbSyncMs` or `storage.index_rebuild_after_init`: note indexing is dominating startup.
- `git.db_sync_completed.syncMode: "full_rebuild"` on desktop means the current code rebuilt the whole index instead of replaying a small delta.
- Small desktop hydration time but large git time: UI is ready quickly and the delay is mostly background sync.
- Large mobile `git.initialize` before `mobile.hydrate_ui`: mobile is still blocked on git before the app becomes interactive.

## Desktop profiling matrix

For desktop startup bottleneck checks, capture 3 runs per scenario and compare medians:

- No remote changes
- Small remote delta
- Larger remote delta
- First launch after clone or cache reset

Record these fields for each run:

- `startup_run_completed.totalMs`
- `git.initialize.durationMs`
- `fetchMs`
- `branchResolveMs`
- `mergeMs`
- `checkoutMs`
- `dbSyncMs`
- `changedPathsMs`
- `indexSyncMs`
- `git.db_sync_completed.syncMode`
- `git.db_sync_completed.changedPathCount`
- `git.db_sync_completed.markdownChangedPathCount`
- `git.db_sync_completed.metrics.noteCount`

## Current limitations

- This is log-based telemetry only; nothing is persisted or uploaded.
- `timestampMs` is relative to the current JS runtime, so compare events within a run, not across separate launches.
- Some index details still arrive via the existing `[notesIndexDb]` logs in addition to `[StartupTrace]`.
