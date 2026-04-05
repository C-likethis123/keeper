# Remove Dead `setNotesRoot` from storageStore

## Background

There are two separate `setNotesRoot` functions in the codebase:

1. **Module-level `setNotesRoot`** in `src/services/notes/Notes.ts` (and platform variants `.android.ts`, `.web.ts`) — sets a module-level `NOTES_ROOT` variable consumed by ~10 services.
2. **Store action `setNotesRoot`** in `src/stores/storageStore.ts` — stores `notesRoot` in Zustand state.

Both are called together in `storageInitializationService.ts`:

```ts
setNotesRoot(result.notesRoot);                          // module-level
useStorageStore.getState().setNotesRoot(result.notesRoot); // store — dead code
```

## Why the Store Version Is Dead Code

`storageStore.notesRoot` is **never read** anywhere. A full grep confirms it is only:
- Written in `storageInitializationService.ts:19`
- Present as `notesRoot: undefined` in 3 test mock objects

No component, hook, or service reads it from the store.

## Why the Module-Level Version Must Stay

On Tauri/desktop, `TauriStorageEngine.initialize()` calls the Rust `storage_initialize` command, which resolves the real app data directory path (e.g. `~/Library/Application Support/keeper/notes`). That path is passed to the module-level `setNotesRoot()` so all services that import `NOTES_ROOT` directly use the correct location. Removing it would break desktop.

## Changes Required

### 1. `src/stores/storageStore.ts`
- Remove `notesRoot?: string` from `StorageState` interface
- Remove `setNotesRoot: (notesRoot?: string) => void` from `StorageState` interface
- Remove `notesRoot: undefined` from initial state
- Remove `setNotesRoot: (notesRoot) => set({ notesRoot })` action

### 2. `src/services/storage/storageInitializationService.ts`
- Remove line: `useStorageStore.getState().setNotesRoot(result.notesRoot);`

### 3. Test files — remove `notesRoot: undefined` from mock store state
- `src/app/__tests__/index.jest.test.tsx` (line 180)
- `src/hooks/__tests__/useLoadNote.test.ts` (line 27)
- `src/components/__tests__/NoteEditorView.jest.test.tsx` (line 290)

## What Is NOT Changed

- `setNotesRoot` in `src/services/notes/Notes.ts`
- `setNotesRoot` in `src/services/notes/Notes.android.ts`
- `setNotesRoot` in `src/services/notes/Notes.web.ts`
- The call to the module-level `setNotesRoot` in `storageInitializationService.ts`
