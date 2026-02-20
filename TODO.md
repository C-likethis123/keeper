# issues
- cursor back and forth: when going to a new line within the same text input, there's a flicker

- fix expo over the air updates

- keyboard avoiding view

- Autocomplete from keyboard not pasted correctly, theres a flicker

- debug desktop tauri app

- I need a system that tracks asks, figures out what is priority, and time spent on X issue
Llm stats - how to be more environmentally friendly?
Bundle size, performance optimisation stats

Figure out how to sort notes - maybe by theme, by priority. Maybe something that auto processes my notes into categories as I tend to spawn new notes. (Recommendation, but for notes)

What makes it relevant?
- time
- topic
- relation to other notes


Archive old journals
Types of notes:
- journals 
- resources
- todos 





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

- video embedding
- pdf viewer, a bit like zotero.
- fix code editor
- drawings (lower priority)
- look at logseq toolbar, it's all a the bottom
- implement flashcards


---
In the future, to support iOS, use `eas build:configure`