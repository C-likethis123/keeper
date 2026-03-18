# TODO

See `ROADMAP.md` for the development roadmap, critical issues, and planned phases.

## Quick Reference

- **Phase 1**: FTS5 wikilink relevance ranking complete
- **Phase 2**: Image blocks (desktop-focused) complete
- **Phase 3**: Editor keyboard shortcut foundation (desktop + web) complete
- **Phase 4**: Editor core test foundation complete with passing `Document`, `Transaction`, and `History` coverage under `vitest`
- **Phase 5**: Test expansion complete for the first lightweight slice; `EditorState`, selected `editorStore` flows, `frontmatter`, and `startupSteps` now have `vitest` coverage
- **Phase 6**: After pure-core expansion, choose and add component/integration test architecture for Expo/React Native UI
- **Next keyboard work**: soft line breaks, checkbox toggle shortcut, better code-block vertical navigation, formatting shortcuts, app-level shortcuts
- **Critical issues**: No currently confirmed P1 items; desktop hydration was fixed in the storage-init follow-up
- **Wikilinks**: create-from-`[[...]]` flow is implemented; next checks are UX polish and device validation
- **Native bridge**: Android and iOS now use the local Expo module in `modules/keeper-git`
- **Testing status**: `npm test` now runs `vitest`; the suite covers the immutable editor core plus `EditorState`, selected `editorStore` flows, `frontmatter`, and `startupSteps`

For full context on each item, see `ROADMAP.md`.
