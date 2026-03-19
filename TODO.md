# TODO

See `ROADMAP.md` for the development roadmap, critical issues, and planned phases.

## Quick Reference

- **Phase 1**: FTS5 wikilink relevance ranking complete
- **Phase 2**: Image blocks (desktop-focused) complete
- **Phase 3**: Editor keyboard shortcut foundation (desktop + web) complete
- **Phase 4**: Editor core test foundation complete with passing `Document`, `Transaction`, and `History` coverage under `vitest`
- **Phase 5**: Test expansion complete for the first lightweight slice; `EditorState`, selected `editorStore` flows, `frontmatter`, and `startupSteps` now have `vitest` coverage
- **Phase 6**: In progress; `jest-expo` + React Native Testing Library are in place, with initial route-aware coverage for `src/app/editor.tsx` and `NoteEditorView`
- **Next keyboard work**: soft line breaks, checkbox toggle shortcut, better code-block vertical navigation, formatting shortcuts, app-level shortcuts
- **Critical issues**: No currently confirmed P1 items; desktop hydration was fixed in the storage-init follow-up
- **Wikilinks**: create-from-`[[...]]` flow is implemented; next checks are UX polish and device validation
- **Native bridge**: Android and iOS now use the local Expo module in `modules/keeper-git`
- **Testing status**: `npm test` covers the immutable editor core plus `EditorState`, selected `editorStore` flows, `frontmatter`, and `startupSteps`; `npm run test:component` now covers `src/app/editor.tsx` and `NoteEditorView`
- **Testing TODO**: Add missing Jest coverage for `HybridEditor`, `EditorToolbar`, `useAutoSave`, `useLoadNote`, startup UI/runtime flows, Wikilink interactions, `src/app/index.tsx`/`NoteGrid`, and additional `editorStore` flows; migrate remaining `vitest` suites to `jest` over time for consistency

For full context on each item, see `ROADMAP.md`.
