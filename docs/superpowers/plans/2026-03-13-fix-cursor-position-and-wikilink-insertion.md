# Cursor Position Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix cursor jumping to end-of-content when the user repositions cursor then types, and ensure wiki link insertion places the cursor after the inserted link.

**Architecture:** `updateBlockContent` in `editorStore.ts` always sets `selectionAfter` to `newContent.length` (end of content). This forces React Native's TextInput to move the cursor to end on every keystroke. The fix: make `selectionAfter` optional — omit it during normal typing so the native TextInput retains cursor position, and pass it explicitly for programmatic insertions (wiki links). The `EditorState` reducer already handles `selectionAfter === undefined` by preserving the current selection (line 128: `transaction.selectionAfter !== undefined ? ...`), so the reducer requires no changes.

**Tech Stack:** TypeScript, Zustand (`editorStore.ts`), React Native TextInput (controlled `selection` prop), `TransactionBuilder` pattern

---

## Chunk 1: Understand the data flow

### Task 1: Read and annotate the key files

**Files:**
- Read: `src/stores/editorStore.ts:80-96`
- Read: `src/components/editor/core/EditorState.ts:119-131`
- Read: `src/components/editor/blocks/UnifiedBlock.tsx:195-218`
- Read: `src/components/editor/wikilinks/WikiLinkContext.tsx:54-140`

**Context for the implementer:**

The bug flow:
1. User taps to position cursor at offset 5 in a block containing "hello world" (11 chars)
2. `handleSelectionChange` fires → store `selection.focus.offset = 5`
3. User types "X" → TextInput fires `onChangeText` with "helloX world" (12 chars)
4. `handleContentChange` (HybridEditor.tsx:36-45) calls `updateBlockContent(index, "helloX world")`
5. `updateBlockContent` (editorStore.ts:80-96) builds a transaction with `selectionAfter = { blockIndex: index, offset: 12 }` ← **BUG: always end of content**
6. Reducer applies transaction → `state.selection.focus.offset = 12`
7. UnifiedBlock re-renders → `selectionProp = { start: 12, end: 12 }` → TextInput forces cursor to end

The reducer at `EditorState.ts:127-130`:
```typescript
selection:
    transaction.selectionAfter !== undefined
        ? transaction.selectionAfter
        : state.selection,
```
If `selectionAfter` is `undefined` (not set in the transaction), the reducer **preserves the existing selection**. This is the key: omitting `selectionAfter` from `updateBlockContent` means the cursor doesn't move.

- [ ] **Step 1: Read all four files above to confirm your understanding matches this plan**

---

## Chunk 2: Fix `updateBlockContent` signature

### Task 2: Add optional `selectionOffset` parameter to `updateBlockContent`

**Files:**
- Modify: `src/stores/editorStore.ts:80-96`

**What to change:** Add an optional `selectionOffset?: number` parameter. When it is `undefined` (the default), omit `.withSelectionAfter()` from the transaction, so the reducer keeps the current selection unchanged. When it is a number, use it to set the cursor to that position.

- [ ] **Step 1: Open `src/stores/editorStore.ts` and locate `updateBlockContent` (lines ~80-96)**

Current code:
```typescript
updateBlockContent: (index: number, newContent: string) => {
    const s = get();
    const block = s.document.blocks[index];
    if (block.content === newContent) return;
    const transaction = new TransactionBuilder()
        .updateContent(index, block.content, newContent)
        .withSelectionBefore(s.selection)
        .withSelectionAfter(
            createCollapsedSelection({
                blockIndex: index,
                offset: newContent.length,
            }),
        )
        .withDescription("Update content")
        .build();
    dispatch({ type: "APPLY_TRANSACTION", transaction });
},
```

- [ ] **Step 2: Replace with the following:**

```typescript
updateBlockContent: (index: number, newContent: string, selectionOffset?: number) => {
    const s = get();
    const block = s.document.blocks[index];
    if (block.content === newContent) return;
    const builder = new TransactionBuilder()
        .updateContent(index, block.content, newContent)
        .withSelectionBefore(s.selection)
        .withDescription("Update content");
    if (selectionOffset !== undefined) {
        builder.withSelectionAfter(
            createCollapsedSelection({
                blockIndex: index,
                offset: selectionOffset,
            }),
        );
    }
    dispatch({ type: "APPLY_TRANSACTION", transaction: builder.build() });
},
```

- [ ] **Step 3: Run the linter to check for TypeScript errors**

```bash
cd /private/tmp/grove/keeper/fix-desktop-styles-a89b && npm run lint
```

Expected: No errors related to `updateBlockContent`. If there are type errors about the `updateBlockContent` signature in other files, they'll be addressed in Task 3.

- [ ] **Step 4: Check if `TransactionBuilder` is fluent (returns `this` on each method)**

Read `src/components/editor/core/Transaction.ts` to confirm the builder returns `this`. If it does NOT return `this` (i.e., it mutates in place and returns `void`), the code in Step 2 that does `builder.withSelectionAfter(...)` inside the `if` block may not re-assign `builder`. In that case, reassign it explicitly:

```typescript
// Correct pattern if builder methods return `this` (fluent):
let builder = new TransactionBuilder()
    .updateContent(index, block.content, newContent)
    .withSelectionBefore(s.selection)
    .withDescription("Update content");
if (selectionOffset !== undefined) {
    builder = builder.withSelectionAfter(
        createCollapsedSelection({ blockIndex: index, offset: selectionOffset }),
    );
}
dispatch({ type: "APPLY_TRANSACTION", transaction: builder.build() });
```

Use this `let builder` pattern (shown above) instead of the initial Step 2 snippet if `withSelectionAfter` returns `this`. Either way, the observable behavior is the same — this step is just about ensuring TypeScript doesn't discard the return value.

- [ ] **Step 4b: Check if `editorStore` exposes a typed interface for its actions**

Search for any `interface EditorStore` or `type EditorState` definition that lists `updateBlockContent`. If found, update the signature there too to add `selectionOffset?: number`.

- [ ] **Step 5: Run lint again after adjusting if needed**

```bash
npm run lint
```

Expected: Clean output (no errors).

- [ ] **Step 6: Commit**

```bash
git add src/stores/editorStore.ts
git commit -m "fix: preserve cursor position during block content updates

updateBlockContent now accepts an optional selectionOffset param.
When omitted, the transaction has no selectionAfter, so the reducer
keeps the current selection — preventing cursor from jumping to end."
```

---

## Chunk 3: Fix wiki link insertion cursor position

### Task 3: Set cursor after `[[link]]` when a wiki link is inserted

**Files:**
- Modify: `src/components/editor/wikilinks/WikiLinkContext.tsx:125-140`

**Context:** When the user selects a wiki link result, `handleSelect` constructs the new block content and calls `updateBlockContent`. With our Task 2 fix, omitting `selectionOffset` would leave the cursor wherever it was before the insertion (which is inside the `[[` autocomplete trigger). We need to explicitly position the cursor right after `]]`.

The new text is constructed as:
```
block.content.substring(0, start) + "[[" + link + "]]" + block.content.substring(start + 2)
```
So the cursor after insertion should be at: `start + 2 + link.length + 2` = `start + link.length + 4`

- [ ] **Step 1: Open `src/components/editor/wikilinks/WikiLinkContext.tsx` and locate `handleSelect` (lines ~125-140)**

Current code:
```typescript
const handleSelect = useCallback(
    (link: string) => {
        if (!isActive) return;

        const doc = useEditorState.getState().document;
        const block = doc.blocks[blockIndexRef.current];
        if (!block) return;

        const start = triggerStartOffsetRef.current;
        const newText = `${block.content.substring(0, start)}[[${link}]]${block.content.substring(start + 2)}`;

        updateBlockContent(blockIndexRef.current, newText);
        endSession();
    },
    [isActive, endSession, updateBlockContent],
);
```

- [ ] **Step 2: Replace with the following:**

```typescript
const handleSelect = useCallback(
    (link: string) => {
        if (!isActive) return;

        const doc = useEditorState.getState().document;
        const block = doc.blocks[blockIndexRef.current];
        if (!block) return;

        const start = triggerStartOffsetRef.current;
        const newText = `${block.content.substring(0, start)}[[${link}]]${block.content.substring(start + 2)}`;
        const cursorAfter = start + link.length + 4; // after [[link]]

        updateBlockContent(blockIndexRef.current, newText, cursorAfter);
        endSession();
    },
    [isActive, endSession, updateBlockContent],
);
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: Clean output.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/wikilinks/WikiLinkContext.tsx
git commit -m "fix: place cursor after [[link]] on wiki link insertion"
```

---

## Chunk 4: Verify no regressions from callers of `updateBlockContent`

### Task 4: Audit existing callers of `updateBlockContent`

**Files:**
- Search: All files calling `updateBlockContent`

The new signature is backward-compatible (optional third param), so existing callers that omit it will now **not** override cursor position. This is the desired behavior for normal typing. But some callers intentionally set content (not user-typed), and may need to set `selectionOffset`.

- [ ] **Step 1: Find all callers**

```bash
grep -rn "updateBlockContent" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Review each caller**

For each caller, determine: is this user-typed content, or a programmatic change?

Known callers to check:

| Caller | File | Purpose | Action needed |
|--------|------|---------|---------------|
| `handleContentChange` | `HybridEditor.tsx:36-45` | User typing | None — omitting `selectionOffset` is correct |
| `handleBlockTypeDetection` | `HybridEditor.tsx:71` | Converts markdown prefix (e.g. `# ` → heading) | May need `selectionOffset: 0` (cursor at start of remaining content) |
| `handleSpace` | `HybridEditor.tsx:133` | Space key — appends a space and calls `handleBlockTypeDetection`. If type detection fires, `updateBlockContent` is called via `handleBlockTypeDetection` (covered above). If no detection, `updateBlockContent` is called with the space-appended content (line 133). This is a user-typing path — omitting `selectionOffset` is correct here. | None |
| `handleSelect` | `WikiLinkContext.tsx` | Wiki link insertion | Already fixed in Task 3 |

- [ ] **Step 3: Fix `handleBlockTypeDetection` if needed**

`handleBlockTypeDetection` (HybridEditor.tsx ~71) calls:
```typescript
updateBlockContent(index, detection.remainingContent);
```
After block type detection (e.g., user types `# ` and it converts to heading1), the remaining content should have the cursor at offset 0 (start). Add:
```typescript
updateBlockContent(index, detection.remainingContent, 0);
```

- [ ] **Step 4: Run lint after any changes**

```bash
npm run lint
```

- [ ] **Step 5: Commit if any callers were updated**

```bash
git add src/components/editor/HybridEditor.tsx
git commit -m "fix: set cursor to start of content after block type detection"
```

---

## Chunk 5: Manual verification

### Task 5: Test the cursor behavior on desktop

- [ ] **Step 1: Start the desktop app**

```bash
npm run desktop
```

- [ ] **Step 2: Test normal typing cursor preservation**

1. Open or create a note
2. Type "hello world" in a block
3. Click/tap to move cursor to between "hello" and " world" (offset 5)
4. Type "X"
5. Expected: cursor stays after "X" (at offset 6), text reads "helloX world"
6. Previously: cursor jumped to end after "helloX world"

- [ ] **Step 3: Test wiki link insertion cursor**

1. Type `[[` in a block to trigger wiki link autocomplete
2. Type a few characters to search
3. Select a result (click or Enter)
4. Expected: cursor appears right after `]]` of the inserted link
5. Previously: cursor jumped to end of the entire line

- [ ] **Step 4: Test no regression on Enter key (block split)**

1. Type in a block and press Enter at a mid-sentence position
2. Expected: cursor is at the start of the new block (existing behavior via `splitBlock`)
3. This should be unaffected since `splitBlock` sets its own `selectionAfter`

- [ ] **Step 5: Test no regression on Backspace at start of block (merge)**

1. Position cursor at start of a block that follows another block
2. Press Backspace
3. Expected: blocks merge, cursor at the merge point
4. This should be unaffected since `mergeWithPrevious` sets its own `selectionAfter`

- [ ] **Step 6: Test block type detection**

1. Type `# ` at start of a blank paragraph
2. Expected: block converts to heading1, cursor sits at offset 0 (start of the remaining empty content). Continue typing — text should appear at the cursor position, not jump to end.

- [ ] **Step 7: Run final lint check and confirm clean**

```bash
npm run lint
```

Expected: No errors or warnings introduced by this change.

All manual tests pass → implementation is complete.
