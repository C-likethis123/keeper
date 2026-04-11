# Keyboard Command Chain Refactor

**Date:** 2026-04-11  
**Status:** Approved  
**Scope:** Cleanup / future-proofing — no behavior changes

## Background

`HybridEditor.tsx` contains two monolithic keyboard handlers — `handleEnter` (~65 lines) and `handleBackspaceAtStart` (~55 lines) — that use implicit priority ordering via if/return chains. Adding a new behavior requires editing these monolithic functions directly.

The global shortcut layer (`editorCommands.ts` + `shortcutRegistry.ts`) already uses a clean command registry pattern. This refactor brings Enter and Backspace in line with that approach.

## Goal

Extract each if/return branch into a named, pure command function. Compose commands into an ordered array. A runner iterates the array and stops at the first command that returns `true`. Priority is now explicit, visible, and reorderable without touching existing handlers.

## Architecture

Two new files join the existing `keyboard/` folder:

```
src/components/editor/keyboard/
  enterCommands.ts       ← new
  backspaceCommands.ts   ← new
  editorCommands.ts      ← unchanged
  shortcutRegistry.ts    ← unchanged
  useEditorKeyboardShortcuts.ts ← unchanged
```

`handleSpace` in `HybridEditor.tsx` is a single-branch handler — it stays as-is.  
`CollapsibleBlock.tsx` is untouched except for tightening one `string` type to `"summary" | "body"`.  
`useBlockInputHandlers.ts` and `UnifiedBlock.tsx` are untouched.

## Command Types

```ts
// enterCommands.ts
export interface EnterCommandContext {
  index: number;
  cursorOffset: number;
  zone?: "summary" | "body";
  block: BlockNode;
  getBlockAtIndex: (i: number) => BlockNode | null;
  detectBlockType: (index: number, content: string, opts?: DetectOpts) => boolean;
  convertTrackedTodo: (index: number, opts?: { insertNextBlock?: boolean }) => boolean;
  updateBlockType: (index: number, type: BlockType) => void;
  focusBlock: (i: number) => void;
  splitBlock: (index: number, offset: number) => void;
  insertBlockAfter: (index: number, block: BlockNode) => void;
  setBlockContent: (index: number, content: string) => void;
}

type EnterCommand = (ctx: EnterCommandContext) => boolean;
```

```ts
// backspaceCommands.ts
export interface BackspaceCommandContext {
  index: number;
  block: BlockNode;
  prevBlock: BlockNode | null;
  getCollapsibleSummary: (block: BlockNode) => string;
  updateBlockType: (index: number, type: BlockType) => void;
  deleteBlock: (index: number) => void;
  mergeWithPrevious: (index: number) => void;
  focusBlock: (i: number) => void;
}

type BackspaceCommand = (ctx: BackspaceCommandContext) => boolean;
```

## Enter Command Chain

Runs in this order. First command to return `true` wins.

| # | Name | Behavior |
|---|------|----------|
| 1 | `skipCodeAndMathBlocks` | If block is `codeBlock`/`mathBlock` → return `true` (no-op) |
| 2 | `handleCollapsibleEnter` | If `collapsibleBlock` + `zone === "summary"` → return `true` (handled locally in CollapsibleBlock); if body zone → split content at cursor, insert paragraph after, focus next |
| 3 | `runBlockTypeDetection` | If content matches a markdown prefix → convert block type, return `true` |
| 4 | `convertTrackedTodo` | If content matches todo trigger pattern → convert + insert next checkbox, return `true` |
| 5 | `exitEmptyList` | If block is `bulletList`/`numberedList`/`checkboxList` with empty content → convert to paragraph, return `true` |
| 6 | `splitBlock` | Default: split block at cursor offset, focus next block, return `true` |

## Backspace Command Chain

Runs in this order. First command to return `true` wins.

| # | Name | Behavior |
|---|------|----------|
| 1 | `convertNonParagraphToDefault` | If block is not `paragraph`/`codeBlock`/`mathBlock`/`collapsibleBlock` → convert to paragraph, return `true` |
| 2 | `deleteEmptyBlock` | If block is empty (collapsible: both content and summary empty) → delete block, focus previous, return `true` |
| 3 | `skipCollapsibleWithContent` | If block is `collapsibleBlock` with content → return `true` (can't merge) |
| 4 | `focusPreviousNonMergeable` | If previous block is `image`/`video`/`collapsibleBlock` → focus previous, return `true` |
| 5 | `mergeWithPrevious` | Default: if index > 0 → merge content into previous block, focus previous, return `true` |

## HybridEditor.tsx Changes

`handleEnter` and `handleBackspaceAtStart` shrink to context assembly + runner call:

```ts
const handleEnter = useCallback(
  (index: number, cursorOffset: number, zone?: "summary" | "body") => {
    const block = getBlockAtIndex(index);
    if (!block) return;
    runEnterChain({
      index, cursorOffset, zone, block,
      getBlockAtIndex,
      detectBlockType: handleBlockTypeDetection,
      convertTrackedTodo: maybeConvertTrackedTodo,
      updateBlockType, focusBlock, splitBlock,
      insertBlockAfter,
      setBlockContent: handleContentChange,
    });
  },
  [...deps],
);

const handleBackspaceAtStart = useCallback(
  (index: number) => {
    const block = getBlockAtIndex(index);
    if (!block) return;
    const prevBlock = index > 0
      ? useEditorState.getState().document.blocks[index - 1]
      : null;
    runBackspaceChain({
      index, block, prevBlock,
      getCollapsibleSummary,
      updateBlockType, deleteBlock, mergeWithPrevious, focusBlock,
    });
  },
  [...deps],
);
```

## Testing

No new test files. The existing `HybridEditorEditingFlows.jest.test.tsx` integration tests cover all Enter/Backspace behaviors end-to-end. Run the suite before and after; passing confirms the refactor is correct.

Individual command functions are pure and independently testable if future behaviors are added.
