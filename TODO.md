# TODO

See `ROADMAP.md` for the development roadmap, critical issues, and planned phases.

## Quick Reference

- **Phase 1**: FTS5 wikilink relevance ranking complete
- **Phase 2**: Image blocks (desktop-focused) complete
- **Phase 3**: Editor keyboard shortcut foundation (desktop + web) complete
- **Phase 4**: Editor core test foundation complete with passing Jest coverage for `Document`, `Transaction`, and `History`
- **Phase 5**: Test expansion complete for the first lightweight slice; `EditorState`, selected `editorStore` flows, `frontmatter`, `repoBootstrapper`, and `startupSteps` now have Jest coverage
- **Phase 6**: Complete; the Jest + React Native Testing Library layer now covers `src/app/editor.tsx`, `src/app/index.tsx`, `src/app/_layout.tsx`, `NoteEditorView`, `NoteFiltersDropdown`, `EditorToolbar`, `BlockRow`, focused `NoteGrid` load-more behavior, `useNotes`, `useToolbarActions`, `useAutoSave`, `useLoadNote`, `useAppStartup`, `startupStrategies`, wikilink modal/overlay flows, `HybridEditor` rendered-wikilink activation across web/iOS/Android, and `noteTypeDerivation` title/content rules
- **Phase 7**: Embedded video player complete with stacked/side layouts and playback position persistence; manual validation on device remains next
- **Phase 8**: Shared UI components and refactors complete; extracted `FilterChip`, `IconButton`, and `useBlockInputHandlers` with full test coverage
- **Phase 9**: Collapsible blocks complete; live `<details>` conversion, toolbar insertion, summary/body editing flows, and automated coverage are in place; next is device validation and polish
- **Phase 12**: PDF/ePub split-screen viewer complete; attachments stored in `_attachments/`, rendered via PDF.js/epub.js in WebView, split-screen shell in `NoteEditorView`, toolbar attachment button, and position persistence; next is device validation and annotation UX polish
- **Phase 14**: YouTube sharing integration planned; handle incoming share intents (Android) and extensions (iOS) to automatically create resource notes
- **Next keyboard work**: better code-block vertical navigation, cursor selection fixes, code-block brace auto-completion fixes; app-level shortcuts (`Cmd+K/N/S`) shipped
- **Critical issues**: No currently confirmed P1 items; desktop hydration was fixed in the storage-init follow-up
- **Wikilinks**: exact-title resolution and create-from-`[[...]]` helpers are implemented, and `HybridEditor` now has platform tests for rendered-link activation; next checks are clickable desktop/web validation, broader editor-flow coverage, UX polish, and device validation
- **Native bridge**: Android and iOS now use the local Expo module in `modules/keeper-git`
- **App updates**: OTA is not working
- **Templates**: reusable templates are first-class note types, indexed with the shared notes index, and now work inside the editor flow
- **Quick composer**: wire the brush action to create a drawing note once drawing support lands
- **Testing status**: `npm test` covers the immutable editor core plus `EditorState`, selected `editorStore` flows, `frontmatter`, `repoBootstrapper`, `startupSteps`, `startupStrategies`, `noteTypeDerivation`, `src/app/editor.tsx`, `src/app/index.tsx`, `src/app/_layout.tsx`, `NoteEditorView`, `NoteFiltersDropdown`, `EditorToolbar`, `BlockRow`, focused `NoteGrid` pagination behavior, `useNotes`, `useToolbarActions`, `useAutoSave`, `useLoadNote`, `useAppStartup`, wikilink modal/overlay interactions, and `HybridEditor` rendered-wikilink activation on web/iOS/Android
- **Testing TODO**: Add `SaveIndicator`-adjacent autosave assertions if needed, deepen `HybridEditor` editing flows beyond rendered wikilinks, and add additional `editorStore` flows as regressions justify them
- **Recently shipped**: note type is now derived automatically from both title cues and lightweight body-content heuristics via `deriveNoteType`; generic notes with checklist-heavy or link-heavy bodies can now save as todos/resources without needing a typed title prefix
- **Recently fixed**: desktop note-list scrolling now loads additional notes again after the Tauri index cursor returned to a plain numeric offset

For full context on each item, see `ROADMAP.md`.
