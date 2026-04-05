# Task 001: Extract Todos From Notes

## Status

- ✅ Implemented
- Roadmap entry: `Phase 10: Extract Todos From Notes ✅`

## Summary

Inline `todo: ` capture inside note blocks is now supported. Typing `todo: ` in a block converts it into a `[[TODO: ...]]` wikilink via `wikiLinkUtils.ts` (`makeTodoTitle`), the wikilink create-on-miss flow generates a stub todo note with the canonical title, and todo lifecycle metadata (`createdAt`, `completedAt`) is persisted through frontmatter and storage mappers. Automated test coverage exists in `HybridEditorWikilinkEditing.jest.test.tsx`.

## Original Overview

Support inline `todo:` capture directly inside note blocks. When a user types `todo: ` in note content, Keeper should convert that text into a wikilinked todo reference, ensure the referenced todo can be tracked independently, and preserve lifecycle timing from creation through completion.

## Why This Matters

- Notes often contain action items before users decide they deserve a dedicated todo note
- Keeper already has separate todo-note metadata and wikilink creation flows, so this feature can connect two existing systems instead of adding another parallel task tracker
- Recording created/completed timestamps makes completed todos more useful for review, latency analysis, and future reporting views

## Current State

- Todo notes already support `status` metadata through frontmatter and storage/index mappers
- The editor already supports wikilink creation and create-on-miss resolution through shared wikilink utilities
- Note categorisation can infer todo-like notes from titles and checklist-heavy content, but there is no extraction flow for inline `todo:` text inside general notes
- Notes do not currently persist dedicated todo lifecycle timestamps such as `createdAt` or `completedAt`

## Desired State

- Typing `todo: ` in a block triggers conversion into a linked todo reference rather than remaining plain text
- The todo reference points at a canonical tracked todo entity, ideally backed by the existing todo-note model unless implementation evidence later proves a separate model is necessary
- Tracked todos preserve lifecycle metadata:
  - `createdAt` when the todo is first extracted
  - `completedAt` when the todo is marked `done`
- Completed todos can show or derive the elapsed duration between creation and completion
- The originating note still retains readable context and a stable backlink path to the todo

## Proposed Implementation Steps

- Add a detection/conversion path for `todo:` block input in the editor, using the same style of intentional trigger handling already used for other block-editing conversions
- Decide and implement the canonical tracked representation:
  - Prefer extending todo notes with lifecycle metadata and link/backlink context
  - Only introduce a separate linked-task record if the existing note model cannot safely represent the feature
- Extend note metadata parsing/stringifying and storage/index mappers to persist todo lifecycle fields needed for tracking and completion timing
- Update wikilink resolution/creation helpers so extracted todos create or resolve the right target and insert the expected wikilink syntax back into the block content
- Define duplicate-handling rules so repeated `todo:` phrases in different contexts do not merge unintentionally
- Surface lifecycle state in the todo editing flow so moving a todo to `done` stamps `completedAt` without losing the original `createdAt`
- Add tests for editor conversion, metadata persistence, duplicate resolution rules, and completion timestamp behavior

## Candidate Files

- `src/components/editor/blocks/UnifiedBlock.tsx`
- `src/components/editor/HybridEditor.tsx`
- `src/components/editor/wikilinks/wikiLinkUtils.ts`
- `src/services/notes/types.ts`
- `src/services/notes/frontmatter.ts`
- `src/services/notes/editorEntryPersistence.ts`
- `src/services/notes/indexDb/mapper.ts`
- `src/components/NoteEditorView.tsx`
- `src/components/__tests__/NoteEditorView.jest.test.tsx`
- `src/components/editor/__tests__/HybridEditorWikilinkEditing.jest.test.tsx`
- `src/services/notes/__tests__/frontmatter.test.ts`

## Acceptance Criteria

- Typing `todo: ` in note content produces a tracked todo link instead of leaving raw trigger text behind
- Newly extracted todos have a stable tracked representation and a recorded creation timestamp
- Marking a tracked todo as `done` records a completion timestamp without overwriting creation time
- The app can determine the elapsed time from creation to completion for completed todos
- Existing non-todo notes and existing todo notes without lifecycle metadata continue to load safely
- Automated tests cover the extraction flow and timestamp persistence rules

## Open Questions

- Should the generated wikilink title be based on the todo text alone, or include note context to avoid accidental collisions?
- Should completion timing be shown directly in todo notes, in the note list, or deferred to a later reporting view?
- Should extraction happen only on exact `todo: ` prefixes, or also on case variants such as `TODO: `?
