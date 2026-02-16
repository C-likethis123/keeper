# Selection as Source of Truth for Focus (Web Editor Pattern)

## Overview

Shift focus management from a separate `focusedBlockIndex` state to deriving focus from `selection`, matching Lexical/ProseMirror/BlockNote. Selection becomes the single source of truth: `selection !== null` means editor has focus; `selection === null` means blurred.

## Design

### Semantics

- `selection: DocumentSelection | null`
  - `null` = editor blurred (no block focused)
  - Non-null = editor focused; cursor/selection in document
- `focusedBlockIndex` = `selection?.focus.blockIndex ?? null` (derived)

### Sync Paths (Block → EditorState)

| Event | Action |
|-------|--------|
| Block onFocus | `setSelection(createCollapsedSelection({ blockIndex, offset }))` |
| Block onSelectionChange | `setSelection({ anchor: { blockIndex, offset: start }, focus: { blockIndex, offset: end } })` |
| Block onBlur | Deferred: only `setSelection(null)` if no other block claimed focus (prevents focus loss on split/delete) |

### Programmatic Focus

Replace `setFocusedBlock(index)` with:

```ts
setSelection(createCollapsedSelection({ blockIndex: index, offset: block.content.length }))
```

### Block isFocused

`isFocused` = `selection !== null && selection.focus.blockIndex === index`

## Implementation Steps

1. EditorState: `selection` allows `null`; remove `focusedBlockIndex`; add `getFocusedBlockIndex()`; replace `setFocusedBlock` with `setSelection`
2. BlockConfig: add `onSelectionChange?: (start: number, end: number) => void`
3. Blocks: call `onSelectionChange?.(start, end)` from `handleSelectionChange`; `onFocus`/`onBlur` already call parent
4. HybridEditor: pass `onSelectionChange`, derive `isFocused` from selection
5. useFocusBlock: `focusBlock(index)` → `setSelection(...)`; `blurBlock()` → `setSelection(null)`

## Files Changed (Implemented)

- `components/editor/core/EditorState.ts` - selection allows null; removed focusedBlockIndex; added getFocusedBlockIndex(); setSelection accepts null
- `components/editor/core/Transaction.ts` - selectionBefore/selectionAfter accept null
- `components/editor/blocks/BlockRegistry.tsx` - added onSelectionChange to BlockConfig
- `components/editor/blocks/UnifiedBlock.tsx`, `ListBlock.tsx`, `CodeBlock.tsx`, `MathBlock.tsx` - call onSelectionChange(start, end)
- `components/editor/HybridEditor.tsx` - handleFocus sets selection; handleBlur sets null; handleSelectionChange syncs from blocks; isFocused derived from selection
- `hooks/useFocusBlock.ts` - focusBlock calls setSelection; blurBlock calls setSelection(null)
