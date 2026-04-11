# Feasibility Analysis: Focused Block Cursor & TextInput Visibility

## Goal

When a block is focused and updated, the text input should receive the update but remain visually hidden. The inline markdown should be visible instead. If the block is focused, the inline markdown should render a custom cursor as if it's a native text input, and support keyboard shortcuts.

---

## Current Architecture

The editor uses an **overlay pattern** in `UnifiedBlock.tsx`:

- **Unfocused blocks**: `TextInput` is hidden (`display: "none"`), `InlineMarkdown` is visible (shows formatted preview)
- **Focused blocks**: `TextInput` is visible (with native cursor), `InlineMarkdown` is hidden (`display: "none"`)

The visibility toggle is controlled by:
```ts
const showInput = isFocused && !hasBlockSelection;
```

There is **no custom cursor** — the editor relies entirely on React Native's native `TextInput` cursor.

---

## Proposed Architecture

Invert the visibility for focused blocks:
- Keep `TextInput` in the view hierarchy (to capture keyboard events and selection) but make it visually hidden (transparent or `opacity: 0`)
- Always show `InlineMarkdown` when focused, and render a custom cursor at the caret position
- Keyboard shortcuts continue to work because the `TextInput` is still focused programmatically

This is already the pattern used by `CodeBlock.tsx`, which renders syntax highlighting beneath a transparent `TextInput` (`color: "#FFFFFF00"`).

---

## Implementation Approach

### 1. Hide TextInput while focused (Easy)

Instead of `display: "none"`, use `color: "transparent"` or `opacity: 0`. This keeps the `TextInput` in the view hierarchy so it can:
- Receive keyboard events
- Sync selection/cursor position
- Handle IME/composition input

```ts
// In UnifiedBlock.tsx
const textInputStyle = [
  styles.input,
  inputSizeStyle,
  textStyle,
  // When focused: transparent text, keep caret visible
  isFocused && !hasBlockSelection
    ? { color: "transparent", caretColor: "auto" }
    : styles.hidden,
];
```

### 2. Show InlineMarkdown when focused (Easy)

Remove the `display: "none"` on the InlineMarkdown overlay when the block is focused:

```ts
// InlineMarkdown overlay
<View
  style={[
    { flex: 1 },
    applyListStyles ? styles.overlayContent : styles.overlay,
    // OLD: isFocused && !hasBlockSelection ? styles.hidden : null,
    // NEW: Always visible (unless block-selected)
    hasBlockSelection ? styles.hidden : null,
  ]}
>
  <InlineMarkdown ... />
</View>
```

### 3. Custom cursor in InlineMarkdown (Moderate)

**Option A — Native caret via transparent text (preferred)**

Use `color: "transparent"` with `caretColor: "auto"` on the TextInput. The native cursor renders on top of the visible InlineMarkdown.

- **Pros**: Minimal code, native cursor behavior, no pixel math
- **Cons**: `caretColor` support varies in React Native; Android cursor handle may still be visible

**Option B — Custom cursor element**

Render a blinking `|` View at the cursor position within InlineMarkdown.

- **Pros**: Full control over appearance, works on all platforms
- **Cons**: Must calculate pixel position from text offset; handle multiline, wrapping, different font styles

**Option C — Inline cursor character**

Insert a `|` character at the cursor offset with a blinking animation.

- **Pros**: No pixel math needed, simple
- **Cons**: May shift layout slightly; cursor width depends on font

**Recommendation**: Try Option A first. If `caretColor` doesn't work reliably, fall back to Option B.

### 4. Keyboard shortcuts (Already works)

Keyboard events are handled at two layers:

1. **Per-block `onKeyPress`** on the TextInput (`UnifiedBlock.handleKeyPress`) — handles Arrow keys, Space, Enter, Backspace. Still fires when TextInput is visually hidden (as long as it's focused).

2. **Global web shortcuts** via `useEditorKeyboardShortcuts.ts` — works independently of focus visibility.

No changes needed.

### 5. Selection synchronization (Already works)

The `selection` prop on TextInput is already synced from the store:
```ts
selectionProp = isFocused && selectionRange
  ? { start: Math.min(selectionRange.start, len), end: Math.min(selectionRange.end, len) }
  : undefined;
```

As long as the TextInput is in the DOM (even if invisible), this continues to work.

---

## Reference: CodeBlock already does this

`CodeBlock.tsx` uses a transparent TextInput over a syntax highlighter:

```tsx
<TextInput
  style={[
    styles.input,
    { color: "#FFFFFF00", fontFamily, fontSize, ... },
  ]}
  // ...
/>
```

The syntax highlighter (`LazySyntaxHighlighter`) renders beneath it. This is exactly the pattern needed for text blocks.

---

## Risks & Concerns

| Risk | Severity | Mitigation |
|------|----------|------------|
| `caretColor` not supported in RN | Medium | Fall back to custom cursor element (Option B) |
| Multiline cursor positioning is complex | Medium | Use transparent text approach to avoid pixel math |
| IME/composition input may behave oddly | Low | Test with CJK input methods |
| Android cursor handle still visible | Medium | May need `selectionHandleColor: "transparent"` |
| InlineMarkdown re-renders on every keystroke | Low | Already happens; already hidden when focused in current impl |
| Wiki link/slash command triggers still need TextInput | Low | TextInput is still active, just transparent |

---

## Recommended Implementation Plan

1. **Make TextInput transparent** instead of hidden:
   ```ts
   style: [..., isFocused ? { color: "transparent", caretColor: "auto" } : styles.hidden]
   ```

2. **Show InlineMarkdown always** when the block is focused:
   ```ts
   // Remove the display: "none" on InlineMarkdown when focused
   ```

3. **Add custom cursor to InlineMarkdown** (only if native caret isn't visible through transparent text):
   - Pass `cursorOffset` prop
   - Render a blinking `|` at the correct position

4. **Test across platforms** (iOS, Android, web) — caret visibility behavior differs

---

## Verdict

**Feasible: Yes.** The architecture already supports this pattern — `CodeBlock` uses transparent text with an overlay, and the keyboard/selection infrastructure is decoupled from visual rendering. The main effort is implementing a custom cursor in `InlineMarkdown` (or verifying that `caretColor: "auto"` with `color: "transparent"` works on your target platforms).

**Estimated effort: 1–3 days** depending on cross-platform testing and cursor implementation approach.

---

## Key Files

| File | Relevance |
|------|-----------|
| `src/components/editor/blocks/UnifiedBlock.tsx` | Main block component — toggle TextInput visibility |
| `src/components/editor/rendering/InlineMarkdown.tsx` | Add custom cursor rendering |
| `src/components/editor/blocks/CodeBlock.tsx` | Reference implementation (transparent text + overlay) |
| `src/stores/editorStore.ts` | Selection state (no changes needed) |
| `src/hooks/useFocusBlock.ts` | Focus management (no changes needed) |
| `src/components/editor/keyboard/shortcutRegistry.ts` | Keyboard shortcuts (no changes needed) |
