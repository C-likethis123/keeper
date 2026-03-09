# Slowness

Somehow I need to checkout in order for things to work.
Whenever there's a new change from another source, it will go to the error branch, cannot do fast forward merges.
Currently the app start time is around 5-7 seconds.
Explore how to improve this process, either by:
    - changing the branching strategy
    - switching to lib2git

# App updates
- fix expo over the air updates


[P1] Desktop hydration can permanently load the editor from the wrong backend. In _layout.tsx (line 98), Tauri now renders the app before StorageInitializationService finishes, but useLoadNote.ts (line 10) only loads once per id. If the app restores an editor route or opens /editor?id=... on startup, NoteService.loadNote() runs against the default expo-opfs backend before the Tauri backend is selected, returns null, and never retries after storage init completes. That leaves a false “Note not found” state for valid desktop notes.

[P2] Quoted titles no longer round-trip correctly on desktop. tauriStorage.ts (line 67) writes titles by manually escaping " as \", but both the JS parser in tauriStorage.ts (line 27) and the Rust parser in storage.rs (line 197) only strip surrounding quotes and do not unescape YAML escapes. A title like He said "hi" will come back as He said \"hi\", and the index rebuild path will store the escaped form too. This is a behavioral regression from the previous gray-matter handling.


Change summary

The commit primarily introduces a native Tauri storage backend and moves note/index persistence behind backend abstractions. It adds Rust commands for note file CRUD and SQLite FTS indexing, a storageStore plus runtime detection/capability gating, initializes storage before git sync, and updates the UI to respect read-only/search availability. It also simplifies desktop startup by hydrating before git sync, adds Metro .wasm support, and removes the Zustand devtools wrapper from the editor store.