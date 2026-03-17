# Known Issues & Bugs

See `ROADMAP.md` for detailed issue descriptions and root causes.

## Critical Issues (P1)

- No currently confirmed P1 issues.

## Performance Issues

- **App Startup**: 5–7 seconds (explore branching strategy or lib2git)
- **Startup architecture**: startup flow refactor shipped (`useAppStartup` + startup strategies), but no confirmed startup latency reduction yet
- **Git Operations**: Slow checkout required for new changes from other sources
- Slow to update
- There is lag time when saving

## Known Regressions & Improvements

- Desktop editor still needs follow-up polish
- Expo OTA (Over-The-Air) updates not working
- Note organization and relevance work is in progress; note metadata plumbing exists, but migration validation and metadata-driven views are not complete yet
- Automated test coverage is still narrow: only `Document`, `Transaction`, and `History` are covered so far, so regressions in `EditorState`, `editorStore`, services, and UI flows can still slip through
- No component/integration test harness exists yet for Expo/React Native surfaces, so editor interactions and storage flows still rely on manual validation

## Minor style issues

Don't pick this unless explicitly requested. I will use it to test the efficacy of my coding agents.
- in web, focused text inputs shows an outline even with 'outlineWidth: 0'
- android does not have this problem.

For implementation details, see `ROADMAP.md`.
