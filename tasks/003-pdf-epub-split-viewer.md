# Task 003: PDF / ePub Split-Screen Viewer

## Status

- Planning
- Roadmap entry: `Phase 12: PDF/ePub Split-Screen Viewer`
- Grove workspace: `codex-pdf-epub-split-4543` / branch `codex/pdf-epub-split-viewer`

## Goal

Allow a note to have an attached PDF or ePub file that renders in a persistent split-screen panel alongside the editor. Desktop splits left (document) / right (editor). Mobile splits top (document) / bottom (editor). The primary use case is reading and annotating articles and books while writing notes.

## Design Decisions

### Rendering engine: WebView + PDF.js / epub.js

- **PDF**: PDF.js loaded from a local HTML asset (`assets/pdfjs/viewer.html`) inside a `WebView`. Avoids native module setup (no C compilation, no pod/gradle changes). Works identically on iOS, Android, web, and Tauri via WebView. If native-quality zoom/selection proves inadequate after device testing, `react-native-pdf` can replace the WebView layer on mobile only.
- **ePub**: epub.js loaded from a local HTML asset (`assets/epubjs/viewer.html`) inside a WebView. epub.js handles EPUB 2 and EPUB 3 natively. No server required — the file is passed as a base64 data URI or local file URI.
- **Web / Tauri desktop**: Use `<iframe>` for PDFs (browser handles rendering natively) and an epub.js iframe for ePub.

### File storage

- Attachments are copied into the note's directory under `_attachments/` (e.g. `notes/my-note/_attachments/article.pdf`).
- New `attachmentStorage.ts` service mirrors `imageStorage.ts` — `copyPickedAttachmentToNote(uri, noteId)` returns a relative path.
- Relative path is persisted in frontmatter: `attachment: _attachments/article.pdf`.
- Attachment type (pdf / epub) is inferred from the file extension.

### Frontmatter extension

```yaml
---
type: resource
attachment: _attachments/article.pdf
---
```

- Only one attachment per note for v1 (can be extended later).
- `attachment` key parsed and stringified in `frontmatter.ts`.

### Split-screen shell

- Lives at the `NoteEditorView` level (not a block), matching the user's request for a persistent side-by-side view.
- Controlled by a `splitMode` state: `'none' | 'pdf' | 'epub'`.
- Desktop/web (`Platform.OS === 'web'` or Tauri): `flexDirection: 'row'` — document panel on the left, editor on the right.
- Mobile: `flexDirection: 'column'` — document panel on top, editor below.
- Resizable divider: a `PanResponder`-driven drag handle. Default split: 50/50 on desktop, 40/60 (document/editor) on mobile.
- Dismiss button in the document panel header closes the split.

### Toolbar entry point

- New toolbar button: paperclip / book icon. Tapping opens a bottom sheet or action sheet: "Attach PDF" / "Attach ePub".
- Uses existing `expo-document-picker` with `type: ['application/pdf', 'application/epub+zip']`.
- On attach: copy to `_attachments/`, write frontmatter, open split panel automatically.
- On subsequent opens: split panel opens automatically if `attachment` is present in frontmatter.

### Annotations (v1)

- Annotations are written into the note body as regular blocks — no PDF annotation layer in v1.
- Selecting text in the PDF.js/epub.js viewer sends a `postMessage` to React Native. The app inserts a new block in the editor with the selected quote prefixed by `> ` (blockquote).
- This keeps the annotation model simple and searchable via the existing FTS5 index.

### ePub format

- epub.js supports EPUB 2 and EPUB 3. Most ebooks and exported articles (Calibre, Apple Books export, Readwise) use EPUB 3.
- The viewer renders reflowable text with font-size/theme controls passed via `postMessage`.
- CFI (Canonical Fragment Identifier) position is persisted via `AsyncStorage` so the reader re-opens at the last position (mirrors `videoPositionStore.ts`).

---

## Implementation Plan

### Step 1: Attachment storage service

Create `src/services/notes/attachmentStorage.ts` mirroring `imageStorage.ts`.

- `copyPickedAttachmentToNote(uri: string, noteId: string): Promise<string>` — copies file into `<notesRoot>/<noteId>/_attachments/<filename>`, returns the relative path `_attachments/<filename>`.
- `resolveAttachmentUri(noteId: string, relativePath: string): Promise<string>` — returns absolute file URI for use in WebView `source`.
- Platform split: `.ts` for native (uses `expo-file-system`), `.web.ts` for web/Tauri (returns object URL or Tauri asset URI).

**Files:**
- `src/services/notes/attachmentStorage.ts` (new)
- `src/services/notes/attachmentStorage.web.ts` (new)

### Step 2: Frontmatter extension

Add `attachment?: string` to the `Note` and `NoteParsed` types, then parse/stringify it in `frontmatter.ts`.

**Files:**
- `src/services/notes/types.ts` — add `attachment?: string`
- `src/services/notes/frontmatter.ts` — parse `attachment` key, stringify it

### Step 3: PDF.js and epub.js viewer assets

Bundle viewer HTML shells into `assets/viewers/`:

- `assets/viewers/pdf/index.html` — minimal PDF.js viewer. Loads `pdfjs-dist` from the bundled script, opens the file URI passed via `window.location.hash` or `postMessage`. Sends `textSelected` messages back on selection.
- `assets/viewers/epub/index.html` — minimal epub.js viewer. Opens the file URI passed via init message. Tracks CFI position, sends it back on page turn.

Use `pdfjs-dist` (npm) and `epubjs` (npm) bundled as self-contained scripts (no CDN dependency). These are added as devDependencies and their `dist/` outputs copied into `assets/viewers/` at build time via a small script in `package.json`.

**Files:**
- `assets/viewers/pdf/index.html` (new)
- `assets/viewers/epub/index.html` (new)
- `package.json` — add `pdfjs-dist`, `epubjs` devDependencies and a `build:viewers` script

### Step 4: Document panel component

Create `src/components/editor/document/DocumentPanel.tsx`.

- Props: `noteId`, `attachmentPath`, `attachmentType: 'pdf' | 'epub'`, `onDismiss`, `style`.
- Resolves the absolute URI via `attachmentStorage`, then renders:
  - **Web/desktop**: `<iframe>` for PDF, `<iframe>` for ePub (both pointing to the local viewer HTML with file URI in hash/query).
  - **Mobile**: `<WebView>` with `source={{ uri: viewerAssetUri }}`, injecting the file URI via `injectedJavaScript`.
- Header bar: attachment filename, dismiss button, page indicator (ePub only).
- Position persistence: reads/writes last CFI or page number via `AsyncStorage` keyed by `noteId + attachmentPath`.
- Text selection → block insert: `onMessage` handler receives `{ type: 'textSelected', text: '...' }` and calls an `onTextSelected(text)` callback prop.

**Files:**
- `src/components/editor/document/DocumentPanel.tsx` (new)
- `src/components/editor/document/documentPositionStore.ts` (new, mirrors `videoPositionStore.ts`)

### Step 5: Split-screen shell in NoteEditorView

Modify `NoteEditorView` to render the split layout when `note.attachment` is set.

- Detect `attachment` on note load → set `splitMode`.
- Toolbar "attach" action → pick file → `attachmentStorage.copyPickedAttachmentToNote` → update note frontmatter → set `splitMode`.
- Layout: wrap editor + document panel in a `View` with `flexDirection: row` (desktop) or `column` (mobile).
- Resizable divider: `PanResponder` drag sets a `splitRatio` state (clamped 0.25–0.75). Persisted in `AsyncStorage` per note.
- `onTextSelected` callback inserts a blockquote block via `editorStore.insertBlock`.

**Files:**
- `src/components/NoteEditorView.tsx` — split layout, splitMode state, attachment wiring
- `src/hooks/useToolbarActions.ts` — add `handleAttachDocument` action

### Step 6: Toolbar button

Add a paperclip/book icon button to `EditorToolbar` that triggers `handleAttachDocument`.

- If no attachment: opens file picker.
- If attachment already exists: opens an action sheet — "View attachment" / "Replace attachment" / "Remove attachment".

**Files:**
- `src/components/editor/EditorToolbar.tsx`
- `src/hooks/useToolbarActions.ts`

### Step 7: Desktop (Tauri) parity

- `attachmentStorage.web.ts` uses Tauri's `convertFileSrc` to produce an asset URI from a local path, or `tauri://localhost/...` scheme.
- The `<iframe>` viewer for desktop passes the converted URI to the PDF.js / epub.js viewer HTML.
- File picker on desktop uses `@tauri-apps/api/dialog` `open()` instead of `expo-document-picker`.
- Platform split already handled by `.web.ts` extension.

**Files:**
- `src/services/notes/attachmentStorage.web.ts`
- `src/hooks/useToolbarActions.ts` — Tauri branch in `handleAttachDocument`

---

## Acceptance Criteria

- Attaching a PDF or ePub from the toolbar copies it into the note's `_attachments/` dir and persists the path in frontmatter.
- Opening a note with an attachment automatically shows the split-screen panel.
- Desktop: document left, editor right. Mobile: document top, editor bottom.
- Drag handle resizes the split.
- Dismiss button collapses the panel; reopening the note restores it.
- PDF pages scroll normally; ePub chapters paginate or scroll.
- Last read position is restored on re-open.
- Selecting text in the document viewer and triggering "quote" inserts a blockquote block in the editor.
- Removing the attachment from the toolbar hides the panel and removes the frontmatter field.

---

## Candidate Files

### New
- `src/services/notes/attachmentStorage.ts`
- `src/services/notes/attachmentStorage.web.ts`
- `src/components/editor/document/DocumentPanel.tsx`
- `src/components/editor/document/documentPositionStore.ts`
- `assets/viewers/pdf/index.html`
- `assets/viewers/epub/index.html`

### Modify
- `src/services/notes/types.ts`
- `src/services/notes/frontmatter.ts`
- `src/components/NoteEditorView.tsx`
- `src/components/editor/EditorToolbar.tsx`
- `src/hooks/useToolbarActions.ts`
- `package.json` (add `pdfjs-dist`, `epubjs` devDeps + `build:viewers` script)

---

## Risks & Open Questions

- **PDF.js bundle size**: `pdfjs-dist` is ~1.5 MB. Acceptable for desktop/web; on mobile the WebView loads it from `assets/` so it's bundled in the APK. Test on a low-end Android device for startup impact.
- **ePub DRM**: epub.js cannot decrypt DRM-protected ePubs (Adobe ADEPT, etc.). Scope is limited to DRM-free files (personal exports, open-access books, Calibre-converted files). Document this limitation clearly.
- **Tauri file URI scheme**: Tauri 2.x uses `asset://localhost/` for local files; `convertFileSrc` handles this. Verify on macOS before claiming desktop parity.
- **expo-document-picker MIME types**: Android MIME filtering for ePub (`application/epub+zip`) is unreliable on some OEM launchers. Fallback: allow `*/*` and validate extension after pick.
- **iOS local file access**: Expo FileSystem can read files copied to `DocumentDirectory`. Confirm the PDF.js WebView can load `file://` URIs on iOS 17+; may need `allowFileAccessFromFileURLs: true` on the WebView.
- **Annotation layer (future)**: v1 annotations are blockquotes in the note. Future work could add a proper annotation overlay in PDF.js (it has a built-in annotation layer API). Kept out of scope for v1.
- **Split resize persistence**: per-note ratio is a nice-to-have; a single global `AsyncStorage` key for the last-used ratio is acceptable for v1.
