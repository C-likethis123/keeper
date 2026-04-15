# Split Panel Video Design

**Date:** 2026-04-15  
**Status:** Approved

## Overview

Replace the inline `VideoBlock` editor block with a screen-level split panel, matching the PDF/ePub split viewer model. A YouTube URL is stored as `attachedVideo` in note frontmatter and managed via a toolbar modal. When present, the video panel always renders on top with the editor below (`flexDirection: "column"`) on all platforms.

---

## Section 1: Data model

`attachedVideo` is an optional string field on `Note` and `NoteParsed`, storing the raw YouTube URL.

```yaml
---
attachedVideo: https://www.youtube.com/watch?v=dQw4w9WgXcQ
---
```

The existing `parseEmbeddedVideoUrl` utility in `videoUtils.ts` converts raw URLs to embed URLs and is reused as-is. No new parsing logic is needed.

**Files:**
- `src/services/notes/types.ts` — add `attachedVideo?: string`
- `src/services/notes/frontmatter.ts` — parse + stringify `attachedVideo`

---

## Section 2: Split-screen shell in NoteEditorView

The existing split-screen shell in `NoteEditorView.native.tsx` (and `.web.tsx`) is extended:

- Add `attachedVideo` state initialised from `note.attachedVideo`
- Add `isVideoVisible` boolean state, initialised to `true` when `attachedVideo` is set
- Add `activePanel: 'document' | 'video'` state. Defaults to `'document'` if a PDF attachment exists, `'video'` otherwise
- `showSplit` is true when the active panel's asset is set and its visibility flag is true
- `splitFlexDir`: document keeps `isDesktop ? "row" : "column"`; video is **always `"column"`** regardless of platform
- Drag handle and `splitRatio` logic unchanged. Default ratio for video: `0.4` (video 40%, editor 60%) on all platforms
- When both `attachment` and `attachedVideo` are present, the toolbar shows a document/video toggle to switch `activePanel`

**Files:**
- `src/components/NoteEditorView.native.tsx`
- `src/components/NoteEditorView.web.tsx`

---

## Section 3: VideoSplitPanel component

New component at `src/components/editor/video/VideoSplitPanel.tsx`.

- Props: `url: string`, `onDismiss: () => void`, `style?: ViewStyle`
- Calls `parseEmbeddedVideoUrl(url)` internally to get `EmbeddedVideoSource`
- Renders `EmbeddedVideoPanel` with the source
- Adds a dismiss button that calls `onDismiss` (sets `isVideoVisible = false` in `NoteEditorView`)
- The minimize/expand `VideoMode` toggle is removed from `EmbeddedVideoPanel` — it was only relevant in the inline block context. In the split panel, dismiss replaces minimize.

`EmbeddedVideoPanel` cleanup: `mode` and `onToggleMode` props are removed.

**Files:**
- `src/components/editor/video/VideoSplitPanel.tsx` (new)
- `src/components/editor/video/EmbeddedVideoPanel.tsx` (remove mode/toggle props)

---

## Section 4: Toolbar button and modal

A video camera icon button is added to `EditorToolbar`. Tapping it opens a modal:

- Single `TextInput` for the YouTube URL
- Confirm / Cancel buttons
- If a video is already attached, the input is pre-filled and a "Remove video" destructive option is shown

**On confirm:**
- `parseEmbeddedVideoUrl` validates the URL. Returns `null` → show inline error: "Not a valid YouTube URL"
- On success: save `attachedVideo` to frontmatter via `noteService.saveNote`, set `isVideoVisible = true`, set `activePanel = 'video'`

**On remove:**
- Clear `attachedVideo` from frontmatter, set `isVideoVisible = false`

**Panel toggle (both PDF and video present):**
- Two grouped icon buttons in the toolbar switch `activePanel` between `'document'` and `'video'`

**Files:**
- `src/components/editor/EditorToolbar.tsx`
- `src/hooks/useToolbarActions.ts` — add `handleAttachVideo`, `handleRemoveVideo`

---

## Section 5: Dead code removal

The following are deleted:

- `src/components/editor/blocks/VideoBlock.tsx` — entire component
- `BlockRegistry` entry for `videoBlock` type
- `EditorScrollContext` sticky video scaffolding: `registerVideoLayout`, `unregisterVideoLayout`, `StickyVideoLayout` interface, `videoLayoutsRef`. The context and provider remain (still used for scroll tracking).
- `VideoBlock` references in `HybridEditor` and `BlockRegistry`
- `BlockType.video` in `BlockNode.ts` and `createVideoBlock` factory, `![video](...)` serialisation in `toMarkdown`, and parsing in `Document.ts`
- `BT.video` reference in `backspaceCommands.ts` (non-mergeable types list)
- Sticky video styles and logic in `BlockRow.tsx`

**Files:**
- `src/components/editor/blocks/VideoBlock.tsx` (delete)
- `src/components/editor/EditorScrollContext.tsx` (remove sticky video scaffolding)
- `src/components/editor/core/BlockNode.ts` (remove `BlockType.video`, `createVideoBlock`)
- `src/components/editor/core/Document.ts` (remove `![video](...)` parsing and `createVideoBlock` call)
- `src/components/editor/core/BlockRegistry.tsx` (remove video entry)
- `src/components/editor/HybridEditor.tsx` (remove VideoBlock wiring)
- `src/components/editor/keyboard/backspaceCommands.ts` (remove `BT.video` from non-mergeable list)
- `src/components/editor/BlockRow.tsx` (remove sticky video styles)

---

## Section 6: Migration script

Standalone script at `scripts/migrate-video-blocks.js`. Runs directly against the notes git repo with no app dependencies.

**What it does:**
1. Walks all `.md` files in the target directory (passed as a CLI arg)
2. Parses frontmatter and block list via regex/string-split (no app imports)
3. For each file: if a `videoBlock` typed block exists and `attachedVideo` is not already set, extracts the first video block's URL, adds `attachedVideo: <url>` to frontmatter, removes all `videoBlock` blocks from the body
4. Writes the modified file in place
5. Prints a summary: files changed, files skipped, errors

**Usage:**
```bash
node scripts/migrate-video-blocks.js /path/to/notes-repo
```

**Files:**
- `scripts/migrate-video-blocks.js` (new)

---

## Acceptance criteria

- Attaching a YouTube URL via the toolbar modal adds `attachedVideo` to frontmatter and opens the split panel
- The video panel is always on top, editor always below (`column` layout) on all platforms including desktop
- Dismissing the panel hides it for the session; reopening the note restores it
- Removing the video from the toolbar clears `attachedVideo` and hides the panel
- When both PDF and video are attached, the toolbar toggle switches between them; only one panel is visible at a time
- `VideoBlock` no longer exists in the editor block list; `BlockType.video` and `![video](...)` syntax are removed
- The migration script converts existing `![video](...)` blocks to `attachedVideo` frontmatter in-place

---

## Candidate files

### New
- `src/components/editor/video/VideoSplitPanel.tsx`
- `scripts/migrate-video-blocks.js`

### Modified
- `src/services/notes/types.ts`
- `src/services/notes/frontmatter.ts`
- `src/components/NoteEditorView.native.tsx`
- `src/components/NoteEditorView.web.tsx`
- `src/components/editor/video/EmbeddedVideoPanel.tsx`
- `src/components/editor/EditorToolbar.tsx`
- `src/hooks/useToolbarActions.ts`
- `src/components/editor/EditorScrollContext.tsx`
- `src/components/editor/core/BlockNode.ts`
- `src/components/editor/core/Document.ts`
- `src/components/editor/core/BlockRegistry.tsx`
- `src/components/editor/HybridEditor.tsx`
- `src/components/editor/keyboard/backspaceCommands.ts`
- `src/components/editor/BlockRow.tsx`

### Deleted
- `src/components/editor/blocks/VideoBlock.tsx`
