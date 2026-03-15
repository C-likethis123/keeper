# TODO

See `ROADMAP.md` for the development roadmap, critical issues, and planned phases.

## Quick Reference

- **Phase 1**: FTS5 wikilink relevance ranking complete
- **Phase 2**: Image blocks (desktop-focused) complete
- **Phase 3**: Editor keyboard shortcut foundation (desktop + web) complete
- **Next keyboard work**: soft line breaks, checkbox toggle shortcut, better code-block vertical navigation, formatting shortcuts, app-level shortcuts
- **Critical issues**: No currently confirmed P1 items; desktop hydration was fixed in the storage-init follow-up
- **Wikilinks**: create-from-`[[...]]` flow is implemented in this workspace; next checks are UX polish and device validation
- **Startup architecture**: startup orchestration moved out of `RootLayout` into `useAppStartup` + runtime startup strategy/step modules; performance work is still open
- **Native bridge**: Android and iOS now use the local Expo module in `modules/keeper-git`

For full context on each item, see `ROADMAP.md`.
