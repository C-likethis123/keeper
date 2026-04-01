# Collapsible Block Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix live `<details>` → CollapsibleBlock conversion so it works while editing (not only on reload), and add a toolbar button to insert collapsible sections.

**Architecture:** Two independent fixes: (1) broaden the `triggerPrefix` regex in `BlockRegistry` to also match `<details></details>` so Enter-triggered type detection fires for the full HTML pattern users commonly type, and (2) wire a new `handleInsertCollapsible` toolbar action through `useToolbarActions` and `EditorToolbar`.

**Tech Stack:** React Native, TypeScript, Jest + `jest-expo` + React Native Testing Library

---

## File Structure

**Modify:**
- `src/components/editor/blocks/BlockRegistry.tsx` — update collapsible `triggerPrefix` regex
- `src/hooks/useToolbarActions.ts` — add `handleInsertCollapsible`
- `src/components/editor/EditorToolbar.tsx` — add collapsible `IconButton`
- `src/components/editor/__tests__/EditorToolbar.jest.test.tsx` — cover new button

**Create:**
- `src/components/editor/blocks/__tests__/BlockRegistry.test.ts` — unit tests for `detectBlockType` with the new variants

---

## Background: why the trigger doesn't fire live

`blockRegistry.detectBlockType(text)` is called from `HybridEditor.handleEnter` with the block's current content. The existing `triggerPrefix: /^<details>$/` matches the exact string `"<details>"` only. When a user types `<details></details>` and presses Enter, `block.content` is `"<details></details>"` which fails the `$` anchor, so no conversion happens. The note is saved as a raw paragraph, and on reload `createDocumentFromMarkdown` parses it correctly — hence the "only works after exit" symptom. The fix is to widen the regex.

---

## Task 1: Fix triggerPrefix so `<details></details>` converts live

**Files:**
- Modify: `src/components/editor/blocks/BlockRegistry.tsx:225-229`
- Create: `src/components/editor/blocks/__tests__/BlockRegistry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/editor/blocks/__tests__/BlockRegistry.test.ts
import { blockRegistry } from "@/components/editor/blocks/BlockRegistry";
import { BlockType } from "@/components/editor/core/BlockNode";

describe("blockRegistry.detectBlockType — collapsible variants", () => {
  it("detects <details> alone", () => {
    const result = blockRegistry.detectBlockType("<details>");
    expect(result?.type).toBe(BlockType.collapsibleBlock);
    expect(result?.remainingContent).toBe("");
  });

  it("detects <details></details>", () => {
    const result = blockRegistry.detectBlockType("<details></details>");
    expect(result?.type).toBe(BlockType.collapsibleBlock);
    expect(result?.remainingContent).toBe("");
  });

  it("detects <details open>", () => {
    const result = blockRegistry.detectBlockType("<details open>");
    expect(result?.type).toBe(BlockType.collapsibleBlock);
  });

  it("detects <details open></details>", () => {
    const result = blockRegistry.detectBlockType("<details open></details>");
    expect(result?.type).toBe(BlockType.collapsibleBlock);
  });

  it("does not detect a partial or mid-string details tag", () => {
    expect(blockRegistry.detectBlockType("some <details> text")).toBeNull();
    expect(blockRegistry.detectBlockType("<details>extra")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="BlockRegistry.test" --no-coverage
```

Expected: FAIL — `<details></details>`, `<details open>`, `<details open></details>` tests fail

- [ ] **Step 3: Update the triggerPrefix in BlockRegistry**

In `src/components/editor/blocks/BlockRegistry.tsx`, change line 226:

Old:
```ts
    {
        type: BlockType.collapsibleBlock,
        triggerPrefix: /^<details>$/,
        markdownPrefix: "<details>",
        build: (config) => renderLazyBlock(LazyCollapsibleBlock, config),
    },
```

New:
```ts
    {
        type: BlockType.collapsibleBlock,
        triggerPrefix: /^<details(?:\s+open)?>(?:<\/details>)?$/,
        markdownPrefix: "<details>",
        build: (config) => renderLazyBlock(LazyCollapsibleBlock, config),
    },
```

The regex breakdown:
- `^<details` — must start with `<details`
- `(?:\s+open)?` — optionally followed by ` open`
- `>` — closing `>`
- `(?:<\/details>)?` — optionally followed by `</details>`
- `$` — nothing else allowed

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="BlockRegistry.test" --no-coverage
```

Expected: PASS — 5 tests passing

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
npm test -- --no-coverage
```

Expected: all previously passing tests still pass

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/blocks/BlockRegistry.tsx src/components/editor/blocks/__tests__/BlockRegistry.test.ts
git commit -m "fix: broaden collapsible triggerPrefix to match <details></details> variant"
```

---

## Task 2: Add toolbar button to insert a collapsible section

**Files:**
- Modify: `src/hooks/useToolbarActions.ts`
- Modify: `src/components/editor/EditorToolbar.tsx`
- Modify: `src/components/editor/__tests__/EditorToolbar.jest.test.tsx`

### 2a — Add the action to `useToolbarActions`

- [ ] **Step 1: Write the failing test for the new action (inside EditorToolbar test)**

Add a new test case in `src/components/editor/__tests__/EditorToolbar.jest.test.tsx`.

First, add `mockHandleInsertCollapsible` next to the other mock functions (around line 12):

```tsx
const mockHandleInsertCollapsible = jest.fn();
```

Second, add it to the `useToolbarActions` mock return value (around line 23):

```tsx
jest.mock("@/hooks/useToolbarActions", () => ({
  useToolbarActions: () => ({
    handleIndent: mockHandleIndent,
    handleOutdent: mockHandleOutdent,
    handleConvertToCheckbox: mockHandleConvertToCheckbox,
    handleInsertImage: mockHandleInsertImage,
    handleInsertCollapsible: mockHandleInsertCollapsible,
  }),
}));
```

Third, add the new test case at the end of the `describe("EditorToolbar")` block:

```tsx
it("inserts a collapsible section when the expand-more button is pressed", () => {
  const { getByRole } = renderToolbar();

  fireEvent.press(getByRole("button", { name: "expand-more" }));

  expect(mockHandleInsertCollapsible).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="EditorToolbar.jest" --no-coverage
```

Expected: FAIL — `expand-more` button not found

- [ ] **Step 3: Add `handleInsertCollapsible` to `useToolbarActions`**

In `src/hooks/useToolbarActions.ts`:

Add `createParagraphBlock` to the import from `BlockNode` and add `updateBlockAttributes` store selector:

```ts
import {
  BlockType,
  createImageBlock,
  createParagraphBlock,
} from "@/components/editor/core/BlockNode";
```

Add `updateBlockAttributes` alongside the other store selectors (after `insertBlockAfter`):

```ts
const updateBlockAttributes = useEditorState((s) => s.updateBlockAttributes);
```

Add the new callback after `handleInsertImage`:

```ts
const handleInsertCollapsible = useCallback(() => {
  const index = getFocusedBlockIndex() ?? 0;
  updateBlockType(index, BlockType.collapsibleBlock);
  updateBlockAttributes(index, { summary: "", isExpanded: true });
  insertBlockAfter(index, createParagraphBlock());
  focusBlock(index);
}, [
  getFocusedBlockIndex,
  updateBlockType,
  updateBlockAttributes,
  insertBlockAfter,
  focusBlock,
]);
```

Update the `UseToolbarActions` interface and return value:

```ts
interface UseToolbarActions {
  handleOutdent: () => void;
  handleIndent: () => void;
  handleConvertToCheckbox: () => void;
  handleInsertImage: () => Promise<void>;
  handleInsertCollapsible: () => void;
}

// In the return:
return {
  handleOutdent,
  handleIndent,
  handleConvertToCheckbox,
  handleInsertImage,
  handleInsertCollapsible,
};
```

- [ ] **Step 4: Add the button to `EditorToolbar`**

In `src/components/editor/EditorToolbar.tsx`, destructure the new action:

```tsx
const {
  handleOutdent,
  handleIndent,
  handleConvertToCheckbox,
  handleInsertImage,
  handleInsertCollapsible,
} = useToolbarActions();
```

Add the `IconButton` after the checkbox button (before the image button section):

```tsx
<IconButton
  name="expand-more"
  onPress={handleInsertCollapsible}
/>
```

The full toolbar `return` body becomes:

```tsx
<View style={styles.toolbar}>
  <IconButton
    name="undo"
    onPress={() => executeEditorCommand("undo", commandContext)}
    disabled={!canUndo}
  />
  <IconButton
    name="redo"
    onPress={() => executeEditorCommand("redo", commandContext)}
    disabled={!canRedo}
  />
  <IconButton
    name="format-indent-increase"
    onPress={handleIndent}
    disabled={!canIndent}
  />
  <IconButton
    name="format-indent-decrease"
    onPress={handleOutdent}
    disabled={!canOutdent}
  />
  <IconButton
    name="check-box-outline-blank"
    onPress={handleConvertToCheckbox}
    disabled={!canConvertToCheckbox}
  />
  <IconButton
    name="expand-more"
    onPress={handleInsertCollapsible}
  />
  {Platform.OS !== "web" ? (
    <IconButton name="add-photo-alternate" onPress={handleInsertImage} />
  ) : (
    <Text>TODO: Insert Image</Text>
  )}
</View>
```

- [ ] **Step 5: Run the toolbar test to verify it passes**

```bash
npm test -- --testPathPattern="EditorToolbar.jest" --no-coverage
```

Expected: PASS — all existing tests plus the new collapsible test pass

- [ ] **Step 6: Run lint and full test suite**

```bash
npm run lint && npm test -- --no-coverage
```

Expected: no lint errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useToolbarActions.ts src/components/editor/EditorToolbar.tsx src/components/editor/__tests__/EditorToolbar.jest.test.tsx
git commit -m "feat: add toolbar button to insert collapsible section"
```

---

## Verification

Run the full suite one final time:

```bash
npm run lint && npm test -- --no-coverage
```

Expected: all tests green, no lint errors.

**Manual smoke test**: Open a note in the editor.
1. Type `<details></details>` in a paragraph and press Enter → should instantly become a CollapsibleBlock (chevron visible, summary/body zones appear).
2. Tap the `expand-more` (▾) toolbar button → should insert a CollapsibleBlock at the cursor position.
3. Verify the slash command `/collapsible` still works.
