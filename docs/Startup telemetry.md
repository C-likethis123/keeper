# Startup telemetry

Keeper emits structured startup timing logs under the `[StartupTrace]` prefix so startup performance work can be measured without a dedicated telemetry backend.

## Where the logs come from

- `src/services/startup/startupStrategies.web.ts`
- `src/services/startup/startupSteps.ts`
- `src/services/startup/startupTelemetry.ts`
- `src/services/notes/notesIndexDb.ts`

## How to view them

- PWA: run `npm start -- --web` and inspect browser developer tools.

Search for `[StartupTrace]` to isolate the structured startup events.

## Log format

Each line uses a stable prefix plus a structured object:

```text
[StartupTrace] {
  runId: "startup-...",
  runtime: "browser-pwa" | "unsupported",
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

- `browser.hydrate_ui`
- `unsupported.hydrate_ui`
- `storage.initialize`
- `storage.index_rebuild_after_init`

Additional trace events:

- `runtime.unsupported_reason`
- `storage.read_only_mode`

## How to read a startup trace

1. Find a single `runId`.
2. Use the bootstrap events to measure the pre-startup gap before `startup_run_started`.
3. Check `startup_run_completed.totalMs` for the measured startup-strategy time only.
4. Compare `step_completed.durationMs` for `storage.initialize` and any rebuild step.

To estimate true JS-side startup from first traced bootstrap event through startup completion:

- `startup_run_completed.timestampMs - bootstrap.layout_module_evaluated.timestampMs`

To estimate how much time passed before the startup strategy even began:

- `startup_run_started.timestampMs - bootstrap.layout_module_evaluated.timestampMs`

## What the numbers usually mean

- A large gap between `bootstrap.layout_module_evaluated` and `bootstrap.run_startup_strategy_invoked` means the missing time is in app/bootstrap/render/effect scheduling, not in git or storage startup steps.
- High `dbSyncMs` or `storage.index_rebuild_after_init`: note indexing is dominating startup.
- Large mobile `git.initialize` before `mobile.hydrate_ui`: mobile is still blocked on git before the app becomes interactive.

## Current limitations

- This is log-based telemetry only; nothing is persisted or uploaded.
- `timestampMs` is relative to the current JS runtime, so compare events within a run, not across separate launches.
- Some index details still arrive via the existing `[notesIndexDb]` logs in addition to `[StartupTrace]`.
