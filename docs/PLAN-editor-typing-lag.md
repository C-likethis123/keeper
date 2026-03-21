# Editor Typing Lag Fix Plan

## Summary

Typing lag most likely comes from editor-wide JS work on every keystroke, not from autosave.

Current evidence:

- `useAutoSave` defers `prepareContent` and `saveNote` until after about 1.5s of input idle time and then runs them through `InteractionManager`
- observed autosave timings are small (`prepareContent` at 0-1ms, `saveNote` at 22-28ms)
- every content edit still dispatches a global editor transaction and updates global selection state
- every `UnifiedBlock` subscribes to the full editor selection object, so caret movement can fan out into editor-wide re-renders
- unfocused blocks rebuild inline markdown preview during those re-renders

## Root Cause Hypothesis

### Primary cause

Global selection churn causes too many block re-renders during typing.

- `HybridEditor.handleContentChange` calls `updateBlockContent(index, content, newCursor)`
- `editorStore.updateBlockContent` builds a transaction with `selectionAfter`
- `editorReducer` applies the transaction and replaces the global `selection`
- every `UnifiedBlock` subscribes to `useEditorSelection()`
- that means a new selection object can cause all blocks to re-render, even when only one block changed
- when unfocused blocks re-render, `InlineMarkdown` reparses their content

This matches the symptom profile better than autosave:

- delayed keystrokes
- queued input feeling
- short UI stalls while typing

### Secondary amplifier

Wiki link state is also shared broadly.

- each `UnifiedBlock` consumes `useWikiLinkContext()`
- opening or canceling a wiki link session updates context state for the whole editor tree
- wiki link start/cancel paths can also mutate block content

This is probably not the baseline cause for all typing lag, but it can make lag worse around `[[...` flows.

## Fix Strategy

Apply the smallest safe changes first, validate on device, then do deeper store refactors only if needed.

### Phase 1: Stop editor-wide block re-renders from selection updates

Goal: only the active block, the previously active block, and blocks whose content actually changed should re-render while typing.

Changes:

1. Narrow `UnifiedBlock` subscriptions
   - remove the `useEditorSelection()` subscription from each block
   - pass only the current block's selection slice from `BlockRow` or a more targeted selector
   - keep each block subscribed to:
     - its own content
     - whether it is focused
     - its own local selection range if focused

2. Avoid using the whole selection object as a dependency in every block
   - replace broad selection reads with selectors such as:
     - `isFocused`
     - `selectionStart`
     - `selectionEnd`
   - return primitive values where possible so Zustand can short-circuit updates

3. Verify render fanout
   - add temporary profiling logs or render counters in `BlockRow` / `UnifiedBlock`
   - confirm that typing in one block does not re-render unrelated blocks

Expected impact:

- biggest likely win
- directly reduces JS work on every keystroke
- should improve both web and native behavior

### Phase 2: Memoize or defer inline preview work for unfocused blocks

Goal: keep inline markdown preview from being reparsed unnecessarily.

Changes:

1. Memoize `InlineMarkdown`
   - wrap it in `React.memo`
   - ensure props are stable when content/style did not change

2. Memoize parsed segments
   - compute `parseInlineMarkdown(...)` inside `useMemo`
   - depend on `text`, `style`, and theme values actually used

3. Keep preview work off the focused block path
   - the focused block already hides the overlay
   - make sure we are not doing preview parse work for hidden overlays unless needed

Expected impact:

- reduces cost of non-focused block updates
- helpful even after selection fanout is fixed

### Phase 3: Isolate wiki link state from non-participating blocks

Goal: typing normally should not make all blocks sensitive to wiki link context churn.

Changes:

1. Remove direct `useWikiLinkContext()` usage from every `UnifiedBlock` if possible
   - pass only minimal handlers/flags needed by the active block
   - or split context so most blocks only consume stable callbacks

2. Keep wiki link session state localized
   - active block index
   - trigger start offset
   - modal open state
   - result list state

3. Re-check the `handleTriggerStart` and `handleCancel` content mutation paths
   - make sure they do not cause extra store writes during ordinary typing

Expected impact:

- reduces extra tree updates when using wikilinks
- lowers risk of modal/context work spilling into the base typing path

### Phase 4: Only optimize store transactions further if Phases 1-3 are insufficient

Goal: avoid deeper editor-state surgery unless profiling still shows JS pressure.

Possible follow-ups:

1. Reduce redundant selection writes
   - only set `selectionAfter` when the cursor actually changed
   - avoid creating new selection objects when values are identical

2. Revisit controlled `TextInput` behavior
   - if native still shows lag after render fanout is reduced, investigate whether the block input should be less tightly controlled during active composition

3. Revisit transaction/history grouping cost
   - profile whether transaction creation/inverse tracking is materially expensive on long notes
   - only optimize if data shows it matters after render fixes

## Suggested Implementation Order

1. Add temporary render instrumentation for `BlockRow`, `UnifiedBlock`, and `InlineMarkdown`
2. Fix selection subscription fanout
3. Re-profile on a long note and on a short note
4. Memoize `InlineMarkdown`
5. Re-profile again
6. Isolate wiki link context only if still needed
7. Remove instrumentation after validation

## Validation Checklist

### Manual checks

- type continuously in a long note with many blocks
- type in the middle of a paragraph, not only at the end
- type quickly enough to reproduce the previous queued-keystroke feeling
- type `[[` and continue into a wiki link query
- verify Enter, Backspace-at-start, list conversion, and block splitting still behave correctly

### Profiling checks

- confirm unrelated blocks no longer re-render on each keystroke
- confirm `InlineMarkdown` does not reparse across the full editor during ordinary typing
- confirm autosave still runs only after idle and does not regress save correctness

### Success criteria

- no visible queued keystrokes during normal typing
- no noticeable editor-wide stalls on medium/long notes
- wiki link typing remains responsive
- no regressions in cursor placement, undo/redo, or block transforms

## Candidate Files

- `src/components/editor/BlockRow.tsx`
- `src/components/editor/HybridEditor.tsx`
- `src/components/editor/blocks/UnifiedBlock.tsx`
- `src/components/editor/rendering/InlineMarkdown.tsx`
- `src/components/editor/wikilinks/WikiLinkContext.tsx`
- `src/stores/editorStore.ts`
- `src/components/editor/core/EditorState.ts`

## Notes

This plan intentionally starts with render-subscription fixes because they are the best fit for the current evidence. Autosave should stay out of scope unless new profiling shows save work overlapping with active typing despite the current idle deferral.
