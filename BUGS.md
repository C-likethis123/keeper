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
- **Editor typing lag**: likely caused by selection-driven editor-wide re-renders plus repeated inline markdown preview work during typing; see `docs/PLAN-editor-typing-lag.md`

## Known Regressions & Improvements

- Desktop editor still needs follow-up polish
- App updates are on hold for now; OTA is not a good fit while the project is still making frequent native-code changes that require full rebuilds
- Note organization and relevance work is in progress; note metadata editing and note-list filters exist, but migration validation and metadata-driven views are not complete yet
- Note templates now persist separately from indexed notes and can be applied inside the editor
- Automated test coverage now includes `Document`, `Transaction`, `History`, `EditorState`, selected `editorStore` flows, `frontmatter`, and `startupSteps`, but UI flows and remaining startup/runtime seams can still slip through until later expansion work
- Component/integration coverage now exists for `src/app/editor.tsx`, `NoteEditorView`, focused `NoteGrid` pagination behavior, and `HybridEditor` rendered-wikilink activation across web/iOS/Android, but broader editor interactions, startup/runtime seams, and storage flows still rely on manual validation

## Minor style issues

Don't pick this unless explicitly requested. I will use it to test the efficacy of my coding agents.
- in web, focused text inputs shows an outline even with 'outlineWidth: 0'
- android does not have this problem.

For implementation details, see `ROADMAP.md`.
