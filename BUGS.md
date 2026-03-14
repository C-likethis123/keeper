# Known Issues & Bugs

See `ROADMAP.md` for detailed issue descriptions and root causes.

## Critical Issues (P1)

- **Desktop Hydration**: Editor loads from wrong backend on startup (affects all notes on desktop)
- **Desktop + mobile dev setup**: Cannot load desktop app and mobile app at the same time
- **Title Escaping**: Quoted titles don't round-trip correctly on desktop (behavioral regression)
- **Desktop Experience**: Major style issues making it difficult to make edits.
- cannot enter from the title input to the note
- cursor cannot type based on selection
- cannot indent in desktop?

## Performance Issues

- **App Startup**: 5–7 seconds (explore branching strategy or lib2git)
- **Git Operations**: Slow checkout required for new changes from other sources
- Wikilinks: I cannot create a wikilink that has not existed yet
- Slow to update

## Known Regressions & Improvements

- Expo OTA (Over-The-Air) updates not working
- Note organization and relevance ranking (in development)

## Minor style issues

Don't pick this unless explicitly requested. I will use it to test the efficacy of my coding agents.
- in web, focused text inputs shows an outline even with 'outlineWidth: 0'
- android does not have this problem.

For implementation details, see `ROADMAP.md`.
