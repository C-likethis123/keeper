# TODO

See `ROADMAP.md` for the development roadmap, critical issues, and planned phases.

## Quick Reference

- **Phase 1**: FTS5 wikilink relevance ranking (in progress)
- **Phase 2**: Image blocks (desktop-only)
- **Phase 3**: Editor undo/redo keyboard shortcuts (web)
- **P1 Bug**: Desktop hydration can load from wrong backend
- **P2 Bug**: Quoted titles don't round-trip on desktop
- **TODO**: Revise note creation flow and desktop serialization boundary; desktop back-navigation crashed with `Can't find variable: Buffer` because renderer-side `gray-matter` serialization ran in the Tauri webview, so future rerenders should keep frontmatter/markdown formatting out of the desktop renderer where possible
- **TODO**: Evaluate replacing the prebuild Git bridge wiring with a local Expo module

For full context on each item, see `ROADMAP.md`.
