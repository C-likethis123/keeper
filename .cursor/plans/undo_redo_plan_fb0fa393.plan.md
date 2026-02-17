---
name: Undo/Redo Plan
overview: Undo/redo is already implemented in the editor core (History, transactions, reducer). This plan fixes a double-pop bug in EditorContext, then adds toolbar buttons and keyboard shortcuts so users can trigger undo/redo.
todos: []
isProject: false
---

# Undo/Redo Implementation Plan

## Current state

The editor already has a full undo/redo backend:

- `**[components/editor/core/History.ts](components/editor/core/History.ts)**` – Undo/redo stacks, grouping by `groupingDelay`, `maxUndoLevels` (100), `push` / `popUndo` / `popRedo` / `clear`.
- `**[components/editor/core/Transaction.ts](components/editor/core/Transaction.ts)**` – Transactions with `createInverseTransaction` so each change can be undone.
- `**[components/editor/core/EditorState.ts](components/editor/core/EditorState.ts)**` – Reducer handles `UNDO` and `REDO`: pops from history and applies inverse/transaction to the document; `SET_DOCUMENT` clears history (e.g. when loading another note).
- `**[contexts/EditorContext.tsx](contexts/EditorContext.tsx)**` – Exposes `undo()`, `redo()`, `getCanUndo()`, `getCanRedo()`.

All document mutations (content, type, list level, insert/delete/split/merge blocks) go through `applyTransaction`, so they are undoable.

**Gap:** There is no UI or keyboard way to trigger undo/redo. The toolbar has indent, outdent, and insert image only.

---

## Bug: double pop in EditorContext

In `[contexts/EditorContext.tsx](contexts/EditorContext.tsx)`, `undo` and `redo` currently:

1. Pop from the history (e.g. `historyRef.current.popUndo(s.document)`).
2. Dispatch `UNDO` / `REDO`.

The reducer then runs and **pops again** in the `UNDO` / `REDO` cases. That consumes two history entries per user action and applies the wrong one.

**Fix:** Have the context only dispatch; let the reducer be the single place that pops and applies.

- **undo:** If `!historyRef.current.canUndo` return false; else `dispatch({ type: 'UNDO' })` and return true.
- **redo:** If `!historyRef.current.canRedo` return false; else `dispatch({ type: 'REDO' })` and return true.

Remove the pop (and inverse/transaction usage) from the context; the reducer already does the pop and apply.

---

## 1. Fix double-pop in EditorContext

In `[contexts/EditorContext.tsx](contexts/EditorContext.tsx)`:

- **undo:** Replace the current body with: check `historyRef.current.canUndo`, then `dispatch({ type: 'UNDO' })`, return true/false. Do not call `popUndo` or use its return value.
- **redo:** Same idea: check `canRedo`, then `dispatch({ type: 'REDO' })`, return true/false. Do not call `popRedo` or use its return value.

No reducer changes needed; they already pop and apply.

---

## 2. Expose undo/redo in the toolbar

`[EditorToolbar](components/editor/EditorToolbar.tsx)` is rendered inside `EditorProvider`, so it can use `useEditorState()`.

- In `EditorToolbar`, call `useEditorState()` and read `undo`, `redo`, `getCanUndo`, `getCanRedo`.
- Add two toolbar buttons (e.g. undo and redo icons), calling `undo()` / `redo()` on press.
- Disable the undo button when `!getCanUndo()`, and the redo button when `!getCanRedo()`.

Re-renders: after undo/redo, the reducer updates `state.document`, so context value changes and the toolbar re-renders; the next `getCanUndo()` / `getCanRedo()` reflect the updated stacks. No extra subscription needed.

Per `[.cursor/rules/callback-props.mdc](.cursor/rules/callback-props.mdc)`: if you later pass `onUndo`/`onRedo` from the parent, make them required if every parent always provides them; here, using the context inside the toolbar avoids new props.

---

## 3. Keyboard shortcuts (web)

On web, users expect Cmd+Z (Mac) / Ctrl+Z (Win/Linux) for undo and Cmd+Shift+Z or Ctrl+Y for redo.

- Add a key-down handler in a component that is under `EditorProvider` and has focus when the user is editing (e.g. `[HybridEditor](components/editor/HybridEditor.tsx)`, or the scroll/content area that wraps the blocks).
- On web only: listen for `keydown`. If (metaKey or ctrlKey) + Z and not shift → `editorState.undo()`, `preventDefault()`. If (metaKey or ctrlKey) + (Shift+Z or Y) → `editorState.redo()`, `preventDefault()`.
- Use a ref for the handler so you don’t need to depend on `editorState` in the effect dependency array (or ensure the listener is updated when editorState changes). Ensure the editor (or a wrapper) is focusable so the key events fire (e.g. `focusable` on web or the existing focus management).

Avoid handling when a modal or a native text field is focused (e.g. wiki link dialog, or a TextInput that might consume the keys). If the editor content area or the block list is the focus target, that’s usually sufficient; if a child TextInput captures focus, you may need to rely on toolbar undo/redo for that platform or add a global shortcut that checks focus.

---

## 4. Optional: header undo/redo

If you want undo/redo in the screen header (e.g. next to pin/delete in `[app/editor.tsx](app/editor.tsx)`), the header is **outside** `EditorProvider`, so it cannot call `useEditorState()`. Options:

- Move the header (or just the undo/redo buttons) inside a small wrapper that sits under `EditorProvider` and renders the header content with access to `useEditorState()`, or
- Keep undo/redo only in the toolbar and keyboard; that’s enough for most use cases.

Recommendation: ship toolbar + keyboard first; add header later only if needed.

---

## Summary


| Item          | Action                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Core logic    | Already implemented (History, Transaction inverse, UNDO/REDO in reducer).                                            |
| Bug           | EditorContext: stop popping in `undo`/`redo`; only dispatch UNDO/REDO.                                               |
| UI            | EditorToolbar: use useEditorState, add undo/redo buttons, disabled when !getCanUndo/!getCanRedo.                     |
| Web shortcuts | In editor (e.g. HybridEditor): on keydown Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (or Y), preventDefault and call undo/redo. |
| Native        | Toolbar + optional future header; no change to native key handling in this plan.                                     |


No changes to History, Transaction, or the reducer beyond the context fix; the rest is wiring and UX.