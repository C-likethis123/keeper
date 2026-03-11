# Known Issues & Bugs

See `ROADMAP.md` for detailed issue descriptions and root causes.

## Critical Issues (P1)

- **Desktop Hydration**: Editor loads from wrong backend on startup (affects all notes on desktop)
- **Title Escaping**: Quoted titles don't round-trip correctly on desktop (behavioral regression)
- **Desktop Experience**: Major style issues making it difficult to make edits.

## Performance Issues

- **App Startup**: 5–7 seconds (explore branching strategy or lib2git)
- **Git Operations**: Slow checkout required for new changes from other sources
- Wikilinks: I cannot create a wikilink that has not existed yet
## Known Regressions & Improvements

- Expo OTA (Over-The-Air) updates not working
- Note organization and relevance ranking (in development)

For implementation details, see `ROADMAP.md`.
