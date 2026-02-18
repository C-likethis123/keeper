# issues
- Pinning within the app does not work
- Does not detect block type changes midway, only for newly created blocks

## Phase 3: Editor undo/redo keyboard shortcuts (web)
- In editor (e.g. HybridEditor): on keydown Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (or Y), preventDefault and call undo/redo.
- Use a ref for the handler so the listener stays correct; ensure the editor or wrapper is focusable so key events fire.
- Avoid handling when a modal or native text field has focus.

## Phase 2: Wikilink overlay
- doesn't always trigger on typing....
- totally fix it!!!! figure out how to position it properly in mobile
Figure out how to make wikilinks clickable

## Phase 2: Image blocks (web)
- it only makes sense to implement this when I am on desktop. I rarely attach screenshots on mobile.

- fix code block issues!

- figure out how to export it! Especially - the over the air updates. Should work for desktop and web.

- on web: keyboard shortcuts


- fix focus issues!

## Future stuff from google keep
- Add drawings

---
In the future, to support iOS, use `eas build:configure`