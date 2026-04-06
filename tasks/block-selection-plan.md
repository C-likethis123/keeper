## Title

Deliver Web-First Block and Gap Selection

## Summary

- Add structured selection primitives (block + gap) on top of the existing character selection model so we can route keyboard/gutter interactions through the store while keeping text inputs untouched.
- Layer a gutter+gap hit area around each block row so the UI can trigger those actions and show the relevant selected-state visuals.
- Wire keyboard shortcuts and focus transitions so block/gap modes can be entered/exited without losing undo history or the inline editing experience.

## Key Changes

- **Store/State** – Expand `EditorStateSlice`/`editorReducer` with `blockSelectionAnchor`, `gapSelection`, `clearStructuredSelection`, `selectGap`, and `selectBlockRange(anchor, focus)` so block selection ranges are tracked explicitly and mutually exclusive with inline caret selection. Ensure `setSelection`/`selectBlock`/`selectGap` clear the other modes.
- **Block UI** – Refactor `BlockRow`/`UnifiedBlock` to render (1) gutter hit targets that dispatch `selectBlock`/range updates and (2) gap targets above/below each block that dispatch `selectGap`. Block rows should use the new selection flags to highlight selected ranges and hide the `TextInput` while block-mode is active, forcing clicks into the text content to call `clearStructuredSelection` before refocusing.
- **Keyboard + Focus** – Extend `useEditorCommandContext` + `useEditorKeyboardShortcuts` so shortcuts like `Ctrl/Meta+A`, arrow keys, `Shift`+arrows, `Enter`, `Backspace/Delete`, and `Escape` manipulate block/gap state: e.g., `Ctrl+A` selects all blocks, arrow keys move the gap caret or block selection, `Enter` at a gap inserts a paragraph, `Escape` collapses back into inline focus. Update `useFocusBlock` so programmatic text focus clears structured selection first.

## Test Plan

- Store tests: add coverage for clearing structured selection, extending block ranges from an anchor, gap insertion semantics (gap index → paragraph placement), and the new action helpers in `src/stores/__tests__/editorStore.test.ts`.
- UI tests: extend `BlockRow`/`HybridEditor` tests to verify gutter clicks select single blocks/ranges, gap clicks render caret visuals, `Enter` from a gap inserts the new block at the right spot, and selecting text via block-mode hides the inline editor until a click/tap targets text content.
- Keyboard tests: expand shortcut coverage so `Meta/Ctrl+A` triggers block selection, arrows navigate gap/block selection correctly, `Shift`+arrows extend the range relative to the anchor, `Enter` inserts from a gap, and `Escape` restores inline focus.
- Run `npm test` in the Grove workspace to capture current failures (noted: wikilink test, index/navigation mocks, safe area provider errors, and storage logs) so the full suite status is documented before further work.

## Assumptions

- Web is the sole platform for the new pointer affordances; native platforms retain their inline-only behavior for now while the state model still syncs.
- “Select between blocks” means a visible insertion gap/caret whose index ranges from `0` to `blockCount`, and inserting there always creates a blank paragraph (no custom clipboard/paste handling yet).
- Block selection remains contiguous and gutter/keyboard driven; drag-based range selection or multi-discontiguous picks are out of scope for v1.
- Existing specialized blocks keep their current focus logic, receiving the structured-selection visuals via the shared row wrapper rather than per-type changes.
