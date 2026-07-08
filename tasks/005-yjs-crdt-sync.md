# Yjs CRDT Sync

## Summary

Keeper stores note body edits as Yjs CRDT updates and keeps Markdown files as generated readable snapshots. Git remains transport. Existing notes migrate lazily on first save/open path that writes the note.

## Implemented Shape

- CRDT update files live under `.keeper-crdt/notes/<encoded-note-id>/updates/<client-id>/<seq>-<hash>.bin`.
- `NoteService.saveNote` writes Markdown changes into a Yjs `Text` document before writing the `.md` snapshot.
- Markdown snapshots still drive current UI loading, indexing, and Git journaling.
- After remote sync, CRDT snapshots are reconciled from update blobs so pulled CRDT changes overwrite generated `.md` content.
- CRDT-backed Markdown conflicts skip `*-sync_conflict` note creation.
- Native and Tauri storage engines expose safe binary file helpers for CRDT blobs.

## Follow-Up

- Bind Lexical directly to `@lexical/yjs` so editor operations are persisted as CRDT operations instead of Markdown diff patches.
- Move selected frontmatter fields into CRDT maps after body behavior is stable.
- Add blob compaction using `Y.mergeUpdates` after update folders grow large.
