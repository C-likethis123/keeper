# Comparative Analysis: Cursor Handling in Block-Based Markdown Editors

This document compares how major editors (Notion, Logseq, Obsidian, Typora, Vditor, BlockNote, and others) handle the cursor in block-based or live-preview markdown editing, then evaluates those approaches against the architecture proposed in `focused-block-cursor-analysis.md`.

---

## 1. The Core Problem

All block-based editors face the same challenge: **the cursor must be visible and functional while the rendered (formatted) content is also visible**. Raw markdown syntax should be hidden during normal reading, but revealed when the user needs to edit it. There are fundamentally different ways to solve this.

---

## 2. Editor Approaches

### 2.1 Notion — Isolated `contenteditable` Blocks with Full Override

| Aspect | Detail |
|--------|--------|
| **Architecture** | Every piece of content is an independent block. Text blocks are isolated `contenteditable` divs. |
| **Cursor** | Native browser cursor inside each `contenteditable`. Each block manages its own cursor independently. No zero-width characters needed for cross-block positioning. |
| **Rendering** | `contenteditable` divs act strictly as **event listeners** — they do not manage or persist state. Every keystroke generates a transaction that replaces the block's entire data value. The view is rebuilt from structured metadata arrays (e.g., `[["text", [["b"]]], [" plain"]]`). |
| **Selection** | Single-block: native browser selection. Cross-block: custom block-level highlighting via `.notion-selectable-halo` div. |
| **Inline formatting** | Never stored as HTML. Stored as structured metadata alongside plain text. DOM is completely rebuilt on every edit, avoiding `document.execCommand`. |
| **Show/hide based on focus** | Not applicable — Notion is a rich-text editor, not a markdown editor. The `contenteditable` always shows the rendered output directly. There is no "source mode" to toggle. |

**Key insight**: Notion completely bypasses native browser editing. The `contenteditable` is a thin event-capturing layer; all state lives in a central model. This is architecturally similar to Keeper's immutable document model, but Notion uses `contenteditable` for input capture while Keeper uses `TextInput`.

---

### 2.2 Logseq — Textarea with CodeMirror Overlay (Hybrid)

| Aspect | Detail |
|--------|--------|
| **Architecture** | Default: plain `<textarea>` per block. Can be replaced with CodeMirror for WYSIWYM mode. |
| **Cursor** | Native textarea cursor (default mode). In CodeMirror mode, CM manages its own cursor. |
| **Rendering** | Default mode renders markdown as HTML *below* or *alongside* the textarea. The textarea captures input; the preview renders formatted output. Known cursor issues: paste behavior, cursor jumping to first block, unexpected position jumps. |
| **Show/hide based on focus** | The textarea is always visible in default mode. In CodeMirror/WYSIWYM mode, the raw source is visible when cursor is on a line, and rendered preview is shown otherwise (similar to Typora). |

**Key insight**: Logseq's default textarea approach has well-documented cursor quirks. The community generally considers cursor behavior a weakness. The CodeMirror overlay approach (similar to Keeper's `CodeBlock` pattern) is preferred but not the default.

---

### 2.3 Obsidian — CodeMirror 6 with Live Preview (Line-Level Toggle)

| Aspect | Detail |
|--------|--------|
| **Architecture** | Single CodeMirror 6 instance for the entire document. Uses CM6's extension system with mark decorations and widgets. |
| **Cursor** | Native CM6 cursor. Position is tracked within CM6's document model. |
| **Rendering** | **Line-level source/preview toggle**: the line containing the cursor shows raw markdown source; all other lines show rendered preview. This is the "Typora-like" live preview mode. |
| **Implementation** | CM6 **mark decorations** render formatted content (bold, italic, etc.) over the raw source text. **Widgets** render complex elements (tables, math, code blocks). The `active line` plugin determines which line shows source. When the cursor moves, decorations are recalculated — the previously-active line reverts to rendered view, and the new line reveals source. |
| **Show/hide based on focus** | Cursor position is the sole determinant. Lines away from cursor = rendered preview. Line at cursor = raw source. Inline elements (bold `**`, links, etc.) use mark decorations that hide the syntax markers when not on the active line. |

**Key insight**: Obsidian's approach is **single-document, cursor-driven toggle**. The entire file is one editor, and the cursor position determines which parts show source vs. preview. This is very different from Keeper's per-block isolation model.

---

### 2.4 Typora — `contenteditable` with Cursor-Sensitive Inline Rendering

| Aspect | Detail |
|--------|--------|
| **Architecture** | Electron app using `contenteditable` divs. Custom DOM management with cursor-sensitive rendering. |
| **Cursor** | Native browser cursor inside `contenteditable`. |
| **Rendering** | **Inline WYSIWYG**: markdown syntax is hidden by default and only revealed when the cursor enters or is adjacent to that span. For example, `**bold**` renders as **bold** until the cursor moves into it, at which point the `**` delimiters become visible. |
| **Show/hide based on focus** | Cursor proximity is the trigger. Markdown delimiters remain hidden until the cursor moves into or near the inline element. Once adjacent, the raw syntax characters are exposed. When the cursor leaves, they hide again. Global toggle (`Cmd+/`) switches to full source mode. |
| **Implementation** | Custom HTML attributes and CSS classes (e.g., `md-focus`, `md-line`, `md-inline`, `mdtype`) track cursor position and block states. Uses CSS visibility rules to show/hide syntax markers based on focus state. |

**Key insight**: Typora's cursor-proximity approach is the closest analogue to Keeper's proposed focused-block approach. The key difference: Typora operates on a continuous `contenteditable` document with CSS class toggling, while Keeper operates on discrete React Native blocks with visibility toggling.

---

### 2.5 Vditor — Three-Mode Editor (WYSIWYG / Instant Rendering / Split View)

| Aspect | Detail |
|--------|--------|
| **Architecture** | Browser-side editor supporting three modes: WYSIWYG (rich text), Instant Rendering (Typora-like), and Split View. |
| **Cursor** | In Instant Rendering mode: cursor position determines which lines show source vs. preview. Similar to Typora/Obsidian but with documented limitations. |
| **Known limitations** | Inline nodes (links, images) do not reliably revert to raw source when cursor enters them. Editing often requires deleting the entire node. Block rendering can trigger prematurely during typing, causing disruptive UI jumps. |

**Key insight**: Vditor demonstrates that the Typora-like approach is **hard to get right**. The most common complaints are cursor behavior inconsistencies within inline elements — exactly the problem Keeper's proposal aims to solve.

---

### 2.6 BlockNote — ProseMirror-Based Block Architecture

| Aspect | Detail |
|--------|--------|
| **Architecture** | Built on ProseMirror + TipTap. Document is a ProseMirror document tree with block-level nodes. |
| **Cursor** | ProseMirror's native selection/cursor system. Uses ProseMirror's `gapcursor` plugin for block-level cursor positions (e.g., between blocks, at image boundaries). |
| **Rendering** | Each block is a ProseMirror node with a NodeView that handles rendering. ProseMirror manages the selection model entirely — no separate input layer needed. |
| **Show/hide based on focus** | Not directly applicable — BlockNote is a rich-text editor, not a markdown source editor. |

**Key insight**: ProseMirror's approach eliminates the dual-layer problem entirely by using a single document model where selection is part of the state. This is conceptually closest to Keeper's immutable transaction model, though Keeper implements it in React Native with `TextInput` rather than `contenteditable`.

---

### 2.7 Other Notable Editors

| Editor | Approach | Cursor Model |
|--------|----------|-------------|
| **Slate.js** | `contenteditable` with custom state. Uses zero-width characters for cursor positioning at block boundaries. Known cursor issues at block edges. | Native within `contenteditable`, but requires workarounds (zero-width chars) for positioning. |
| **HyperMD** | CodeMirror-based. Inline elements rendered in styled form, source revealed on cursor enter/focus. | Cursor proximity triggers source reveal. Complex structures (tables) are problematic. |
| **CodeMirror 6 (generic)** | Extension-based. Mark decorations for inline rendering, widgets for block elements. `activeLine` determines source visibility. | Single cursor, line-level toggle via decoration recalculation. |
| **Draft.js** | Facebook's `contenteditable` framework. Block-level content with decorator patterns. Largely superseded by Slate/ProseMirror. | Native `contenteditable` cursor per block. |

---

## 3. Taxonomy of Approaches

All editors fall into one of **four archetypes**:

### Archetype A: Native `contenteditable` (Notion, Typora)
- Each editable region is a native `contenteditable` div
- Cursor is the browser's native cursor
- Rendering is either direct (Notion: always rendered) or cursor-sensitive (Typora: show/hide syntax based on cursor proximity)
- **Pros**: Native input handling, IME support, minimal sync needed
- **Cons**: Browser inconsistencies, cross-browser testing burden, `contenteditable` quirks

### Archetype B: CodeMirror Single Instance (Obsidian, HyperMD)
- One CM6 instance manages the entire document
- Mark decorations and widgets render formatted content over source
- `activeLine` plugin toggles source/preview per line
- **Pros**: Single cursor, consistent behavior, powerful extension API
- **Cons**: Complex decoration management, must manually track cursor→render mapping

### Archetype C: Overlay / Transparent Input (Keeper's `CodeBlock`, VS Code minimap)
- Raw input element (`TextInput` / `textarea`) is visually transparent
- Rendered content sits beneath as a visual layer
- Input captures all keyboard events; rendered layer is purely visual
- **Pros**: Clean separation, native input handling, no pixel math
- **Cons**: Cursor visibility depends on `caretColor` support, handle may leak through

### Archetype D: Dual-Layer Toggle (Keeper's current `UnifiedBlock`)
- Focused block: `TextInput` visible, `InlineMarkdown` hidden
- Unfocused blocks: `TextInput` hidden, `InlineMarkdown` visible
- **Pros**: Simple, no rendering conflicts
- **Cons**: User sees raw `TextInput` styling instead of formatted markdown while editing

---

## 4. Comparison with Keeper's Proposed Architecture

### Keeper's Current Architecture (Archetype D)

```
Focused block:    [TextInput VISIBLE]  [InlineMarkdown HIDDEN]
Unfocused blocks: [TextInput HIDDEN]   [InlineMarkdown VISIBLE]
```

### Keeper's Proposed Architecture (Archetype C)

```
Focused block:    [TextInput TRANSPARENT]  [InlineMarkdown VISIBLE + custom cursor]
Unfocused blocks: [TextInput HIDDEN]       [InlineMarkdown VISIBLE]
```

### Key Differences from Other Editors

| Factor | Notion | Obsidian | Typora | **Keeper (proposed)** |
|--------|--------|----------|--------|----------------------|
| **Platform** | Web (browser) | Desktop (Electron + CM6) | Desktop (Electron) | Mobile (React Native) |
| **Input layer** | `contenteditable` | CodeMirror 6 | `contenteditable` | `TextInput` (transparent) |
| **Render layer** | Structured data → DOM | Mark decorations + widgets | CSS class toggling | `InlineMarkdown` React component |
| **Cursor** | Native browser | CM6 native | Native browser | Custom (or native via `caretColor`) |
| **Toggle scope** | N/A (rich text) | Per-line | Cursor proximity (inline) | **Per-block** |
| **State model** | Central transaction model | CM6 state tree | DOM-driven | Immutable `Document` + `Transaction` |

### Closest Analogues to Keeper's Proposal

1. **CodeBlock (internal reference)**: Keeper already uses Archetype C for code blocks. The proposal extends this to all block types.

2. **Typora**: Closest in spirit — cursor proximity reveals/hides syntax. But Typora uses CSS on `contenteditable`; Keeper uses React Native visibility on discrete blocks.

3. **Obsidian Live Preview**: Closest in mechanism — source shows at cursor, preview elsewhere. But Obsidian operates at the line level within a single editor, while Keeper operates at the block level across isolated components.

---

## 5. What Other Editors Get Right (Lessons for Keeper)

### From Obsidian:
- **Line-level toggle is too granular** for a block-based model. Keeper's per-block toggle is a better fit for its architecture.
- **Mark decorations are powerful** but require complex state management. Keeper's `InlineMarkdown` component is simpler but achieves the same visual result.

### From Typora:
- **Cursor-proximity reveal** is the gold UX standard. Keeper's per-block approach is a reasonable simplification — the entire block reveals/hides rather than individual inline elements.
- **Global source toggle** (`Cmd+/`) is a useful escape hatch. Keeper could add this for debugging or power users.

### From Notion:
- **Isolated block editing** eliminates cross-block cursor complexity. Keeper already does this — each `UnifiedBlock` is independent.
- **Transaction-based state** ensures consistency. Keeper's `Document` + `Transaction` model is architecturally similar.

### From Vditor (cautionary):
- **Inline node editing is the hardest part**. Vditor's biggest complaint is that inline elements don't reliably revert to source when the cursor enters. Keeper's custom cursor implementation must handle this carefully.
- **Premature rendering during typing** is disruptive. Keeper's 2s autosave debounce helps, but the inline render on every keystroke could still cause jank.

### From Logseq (cautionary):
- **Cursor quirks in overlay modes are user-facing**. Logseq's textarea + preview approach has well-documented cursor jump issues. Keeper must ensure the transparent `TextInput` + `InlineMarkdown` approach keeps cursor position perfectly synced.

---

## 6. Risks Specific to Keeper's Approach

| Risk | Severity | How Others Handle It | Keeper Mitigation |
|------|----------|---------------------|-------------------|
| `caretColor` not supported in RN | Medium | Notion/Typora use native browser cursor (always visible) | Fall back to custom cursor element (doc's Option B) |
| Cursor handle bleeds through transparent text | Medium | Obsidian uses CM6 decorations (no native cursor leak) | Test `selectionHandleColor: "transparent"` on Android |
| InlineMarkdown re-renders on every keystroke | Low | Obsidian recalculates decorations on every cursor move (already expensive) | Already happens in current impl; `InlineMarkdown` is already memoized |
| IME/CJK input with transparent TextInput | Low | Typora handles this natively in `contenteditable` | Test thoroughly; transparent text shouldn't affect IME |
| Cursor position drift between TextInput and InlineMarkdown | Medium | Vditor's biggest complaint | Keep TextInput in DOM (not `display: none`), use `selection` prop sync |
| Multiline cursor positioning | Medium | Obsidian uses CM6's built-in line tracking | Option A (native caret) avoids pixel math; Option B requires it |

---

## 7. Verdict: Keeper's Proposal in Context

Keeper's proposed architecture (Archetype C: transparent input overlay) is **well-grounded** in established patterns:

- **It matches Typora's UX goal** (see syntax only when editing) but adapts it for React Native's constraints
- **It matches Obsidian's mechanism** (source at cursor, preview elsewhere) but at block granularity instead of line granularity
- **It matches Notion's isolation model** (each block is independent) but with a dual render layer instead of `contenteditable`
- **It already works internally** for `CodeBlock`, proving the pattern is viable within the codebase

The **main differentiator** from other editors is the platform: React Native's `TextInput` is not `contenteditable` and not CodeMirror. The transparent text overlay pattern is less documented in RN than in web, but the fundamental mechanics (input captures events, rendered layer is visual) are identical.

**The approach is sound.** The primary execution risk is cross-platform cursor rendering consistency (`caretColor` support), which the proposal already accounts for with a fallback to a custom cursor element.
