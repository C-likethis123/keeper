# Known Issues & Bugs

See `ROADMAP.md` for detailed issue descriptions and root causes.

## Critical Issues (P1)

- No currently confirmed P1 issues.

## Performance Issues

- **App Startup**: 5–7 seconds (explore branching strategy or lib2git)
- **Startup architecture**: startup flow refactor shipped (`useAppStartup` + startup strategies), but no confirmed startup latency reduction yet
- **Git Operations**: Slow checkout required for new changes from other sources
- Slow to update
- **Saving responsiveness**: autosave now waits for input idle time and defers heavier prepare work until after interactions, but device-side validation is still needed before calling save lag fully resolved
- space does not work

## Known Regressions & Improvements

- Desktop editor still needs follow-up polish
- Expo OTA (Over-The-Air) updates not working
- Note organization and relevance work is in progress; note metadata editing and note-list filters exist, but migration validation and metadata-driven views are not complete yet

## Minor style issues

Don't pick this unless explicitly requested. I will use it to test the efficacy of my coding agents.
- in web, focused text inputs shows an outline even with 'outlineWidth: 0'
- android does not have this problem.

For implementation details, see `ROADMAP.md`.
