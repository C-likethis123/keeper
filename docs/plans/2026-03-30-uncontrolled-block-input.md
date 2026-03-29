# Uncontrolled Block TextInput Investigation

## Summary

Making the current block `TextInput` uncontrolled is feasible, but the change is larger than replacing `value` with `defaultValue`.

The current typing path is controlled by both:

- block content in the editor store
- block selection in the editor store

That means the focused `UnifiedBlock` still re-renders on each keystroke and on each caret move. Slash commands and wikilinks also currently mutate canonical block content in the store while the user is typing, so an uncontrolled input needs a draft layer or imperative sync path rather than a simple prop change.

## Current Architecture

### Controlled text path

- `UnifiedBlock` renders `TextInput` with `value={block.content}`
- `UnifiedBlock.handleContentChange(...)` calls `onContentChange(index, newText)`
- `HybridEditor.handleContentChange(...)` computes a cursor and calls `updateBlockContent(index, content, newCursor)`
- `editorStore.updateBlockContent(...)` creates and applies a transaction
- the document in Zustand changes, causing the block to receive new `block.content`

Relevant files:

- `src/components/editor/blocks/UnifiedBlock.tsx`
- `src/components/editor/HybridEditor.tsx`
- `src/stores/editorStore.ts`

### Controlled selection path

- `UnifiedBlock` derives `selectionProp` from store selection
- `TextInput` receives `selection={selectionProp}` when focused
- `UnifiedBlock.onSelectionChange` calls back to `HybridEditor`
- `HybridEditor.handleSelectionChange(...)` writes the new selection into the store
- the focused block subscribes to that selection through `useEditorBlockSelection(index)`

This means removing `value` alone would still leave the focused block store-driven on every cursor move.

### Save path

- autosave listens for document version changes
- autosave serializes markdown from the store document
- `forceSave()` also reads from the store document

So if text only lives in a native uncontrolled input, save correctness breaks unless the draft is flushed into the store before save.

### Formatting and command path

Toolbar actions and keyboard shortcuts currently operate on:

- store selection
- store document
- store block type / list state

Inline formatting, block transforms, undo/redo, indent/outdent, and checkbox toggles all assume canonical editor state already contains the latest typed text.

### Slash command and wikilink path

Slash commands and wikilinks are not passive overlays right now. They modify the block content in the store when triggered:

- slash command start trims the block down to a `/` token
- slash cancel/select removes that token from store content
- wikilink start trims the block down to `[[`
- wikilink cancel/select removes or replaces that token in store content

This is the main reason an uncontrolled input needs either:

- a draft-aware overlay API
- or imperative input mutation coordinated with the store

## Main Constraints

### Constraint 1: text and selection are both source-of-truth in the store

Today the active block is controlled by:

- `block.content`
- `selection`

To avoid per-keystroke re-renders, both need to stop driving the focused block during active editing.

### Constraint 2: save only sees canonical store content

Autosave and forced save read from `documentToMarkdown(state.document)`. If the active input holds newer text than the store, save can miss edits.

### Constraint 3: formatting commands assume canonical state

Bold/italic, heading toggles, list transforms, split/merge, and similar operations need the current text and caret range. If the store lags behind the input, those operations act on stale content unless the draft is flushed first.

### Constraint 4: overlays currently mutate canonical content during typing

Slash commands and wikilinks are implemented as content mutations plus modal state, not as purely derived UI from a draft string.

## Viable Design

The safest design is to introduce an active-block draft controller and keep only one focused block uncontrolled at a time.

### Core idea

While a block is focused:

- text lives in a ref, not React state
- selection lives in a ref, not the editor store
- `TextInput` is uncontrolled
- store updates happen only when required by structural/editor operations

When a block is not focused:

- render from canonical store content as today
- show markdown preview as today

### Draft controller responsibilities

A draft controller should track:

- active `blockId`
- active `blockIndex`
- `textRef`
- `selectionRef`
- `dirtyRef`
- `inputRef`

It should expose:

- `startEditing(block)`
- `updateDraftText(text)`
- `updateDraftSelection(start, end)`
- `flushActiveDraft()`
- `replaceDraftText(text, selection?)`
- `clearActiveDraft()`

### Flush boundaries

`flushActiveDraft()` needs to run before any operation that depends on canonical state:

- autosave interval save
- `forceSave()`
- toolbar formatting
- keyboard shortcut formatting
- type conversion
- split block
- merge/delete/backspace-at-start
- insert image / template / other structural edits
- blur and navigation away
- undo / redo

## Recommended Migration

### Phase 1: add active draft infrastructure

Add a single active-block draft layer near `HybridEditor`.

Goals:

- keep exactly one focused block uncontrolled
- do not change the unfocused render path yet
- preserve existing store document model for everything else

### Phase 2: make focused `UnifiedBlock` uncontrolled

For the focused block:

- remove `value={block.content}`
- stop pushing selection from store on normal typing
- use `defaultValue` when the block becomes active
- use imperative updates only after structural operations

For unfocused blocks:

- continue to render preview from store content

### Phase 3: convert overlay triggers to draft-aware behavior

Refactor slash command and wikilink flows so they read from the active draft instead of mutating store content immediately.

Desired behavior:

- typing `/foo` opens slash commands based on draft text
- typing `[[foo` opens wikilink search based on draft text
- cancel/select updates the draft text first
- only one store write happens when the operation is committed or explicitly flushed

### Phase 4: flush before canonical commands

Update command entry points to flush the active draft first:

- `useAutoSave`
- `useEditorCommandContext`
- `useToolbarActions`
- block structural handlers in `HybridEditor`

### Phase 5: revisit history semantics

This is a product decision.

Current behavior:

- each typed change becomes a transaction

Draft-based behavior likely becomes:

- one transaction per flush boundary

That may be acceptable, but it changes undo granularity and should be validated explicitly.

## Practical Notes

### Autosave

Autosave currently keys off document version changes. If typing no longer bumps document version on every key, autosave should:

- flush before saving
- or observe draft dirtiness in addition to store document version

The simpler model is:

- `forceSave()` flushes first
- periodic autosave flushes first if a draft is dirty

### Selection and focus

Selection as canonical editor state still works well for:

- which block is focused
- programmatic focus after split/merge
- command execution

But the focused block should not subscribe to store selection offsets during active typing. Use local selection refs while focused, then sync back on flush.

### Structural edits

Operations like:

- Enter to split
- Backspace at start
- block type detection
- merge with previous

must flush the draft first or operate directly against draft text and then write the resulting structural transaction.

### Overlay dismissal/refocus

Slash command and wikilink flows currently cycle store selection through `null` and back to restore native focus after modal dismissal. That may still work, but if focus and caret are partially draft-owned, the refocus path should restore:

- block focus
- draft text
- draft selection

without relying on store selection offsets being current.

## Risks

### Undo/redo changes

If drafts are flushed less often, undo granularity changes. This is the biggest behavioral risk.

### Stale canonical state

Any command path that forgets to flush can operate on stale content and cause data loss or surprising formatting.

### Overlay complexity

Slash command and wikilink code currently assumes canonical content mutations. Refactoring these to draft-aware logic is necessary for correctness.

### Cross-platform input behavior

React Native `TextInput` behavior differs between web and native, especially around:

- `selection`
- focus transfer
- `onKeyPress`
- newline insertion
- imperative text updates

This needs validation on both native and web before fully committing to the approach.

## Recommendation

Proceed, but do it as a focused architectural refactor rather than a small prop-level optimization.

The minimum viable path is:

1. introduce an active-block draft controller
2. make only the focused `UnifiedBlock` uncontrolled
3. flush draft text before save and before editor commands
4. refactor slash commands and wikilinks to operate on draft text
5. decide explicitly what undo granularity should become

## Candidate Files

- `src/components/editor/blocks/UnifiedBlock.tsx`
- `src/components/editor/HybridEditor.tsx`
- `src/stores/editorStore.ts`
- `src/hooks/useAutoSave.ts`
- `src/components/editor/slash-commands/SlashCommandContext.tsx`
- `src/components/editor/wikilinks/WikiLinkContext.tsx`
- `src/components/editor/BlockRow.tsx`
- `src/components/editor/keyboard/useEditorCommandContext.ts`
- `src/hooks/useToolbarActions.ts`
