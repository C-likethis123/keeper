# TODO

See `ROADMAP.md` for the development roadmap, critical issues, and planned phases.

## Quick Reference

- **Phase 1**: FTS5 wikilink relevance ranking complete
- **Phase 2**: Image blocks (desktop-focused) complete
- **Phase 3**: Editor keyboard shortcut foundation (desktop + web) complete
- **Phase 4**: Editor core test foundation complete with passing Jest coverage for `Document`, `Transaction`, and `History`
- **Phase 5**: Test expansion complete for the first lightweight slice; `EditorState`, selected `editorStore` flows, `frontmatter`, `repoBootstrapper`, and `startupSteps` now have Jest coverage
- **Phase 6**: In progress; `jest-expo` + React Native Testing Library are in place, with coverage for `src/app/editor.tsx`, `src/app/index.tsx`, `NoteEditorView`, `NoteFiltersDropdown`, focused `NoteGrid` load-more behavior, wikilink modal/overlay flows, and `HybridEditor` rendered-wikilink activation across web/iOS/Android
- **Next keyboard work**: better code-block vertical navigation, cursor selection fixes, code-block brace auto-completion fixes; app-level shortcuts (`Cmd+K/N/S`) shipped
- **Critical issues**: No currently confirmed P1 items; desktop hydration was fixed in the storage-init follow-up
- **Wikilinks**: exact-title resolution and create-from-`[[...]]` helpers are implemented, and `HybridEditor` now has platform tests for rendered-link activation; next checks are clickable desktop/web validation, broader editor-flow coverage, UX polish, and device validation
- **Native bridge**: Android and iOS now use the local Expo module in `modules/keeper-git`
- **App updates**: on hold; OTA is not a good fit while the project still makes frequent native-code changes that require full rebuilds
- **Templates**: reusable templates now work inside the editor flow; remaining work is starting new notes from a template and deciding how templates should surface outside the editor
- **Quick composer**: wire the brush action to create a drawing note once drawing support lands
- **Testing status**: `npm test` covers the immutable editor core plus `EditorState`, selected `editorStore` flows, `frontmatter`, `repoBootstrapper`, `startupSteps`, `src/app/editor.tsx`, `src/app/index.tsx`, `NoteEditorView`, `NoteFiltersDropdown`, focused `NoteGrid` pagination behavior, wikilink modal/overlay interactions, and `HybridEditor` rendered-wikilink activation on web/iOS/Android
- **Testing TODO**: Add missing Jest coverage for `EditorToolbar`, `useAutoSave`, `useLoadNote`, startup UI/runtime flows, broader `NoteGrid` and note-list states, deeper `HybridEditor` editing flows beyond rendered wikilinks, and additional `editorStore` flows
- **Recently fixed**: desktop note-list scrolling now loads additional notes again after the Tauri index cursor returned to a plain numeric offset

For full context on each item, see `ROADMAP.md`.
