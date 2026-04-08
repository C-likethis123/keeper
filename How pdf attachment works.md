Attaching starts from the toolbar paperclip button in src/components/editor/
  EditorToolbar.tsx. In the editor view, that button calls handleAttachDocument, which
  opens a picker, accepts only .pdf or .epub, copies the picked file into the notes
  attachment area, then stores the returned relative path like _attachments/...pdf on the
  note and updates local UI state so the split view opens immediately. On desktop/Tauri
  it uses the Tauri dialog and Tauri copy command in src/components/
  NoteEditorView.web.tsx:289 plus src/services/notes/attachmentStorage.web.ts. On mobile
  it uses expo-document-picker in src/components/NoteEditorView.native.tsx:289 plus src/
  services/notes/attachmentStorage.native.ts. The attachment path is also supported in
  frontmatter via src/services/notes/frontmatter.ts:95 and src/services/notes/
  frontmatter.ts:141.

  The split screen itself lives in NoteEditorView. It keeps attachmentPath,
  attachmentType, and a persisted splitRatio in state; when both attachment values are
  non-null, it renders a two-pane layout with the document panel on the left for desktop/
  web and on top for mobile, with a draggable divider clamped to 25% to 75% in src/
  components/NoteEditorView.web.tsx:78, src/components/NoteEditorView.web.tsx:92, and
  src/components/NoteEditorView.web.tsx:361. Native is the same shape in src/components/
  NoteEditorView.native.tsx:78 and src/components/NoteEditorView.native.tsx:357. The
  ratio is stored in AsyncStorage under doc-split-ratio.

  For PDF viewing specifically, DocumentPanel resolves the stored relative attachment
  path into a real file URI first. On web/Tauri, PDFs are shown by dropping that URI
  straight into an <iframe> in src/components/editor/document/DocumentPanel.web.tsx:128,
  so the browser/Tauri webview does the rendering natively. On native, PDFs go through a
  WebView that loads a tiny HTML wrapper with an <embed> tag in src/components/editor/
  document/DocumentPanel.native.tsx:153 and src/components/editor/document/
  viewerTemplates.ts:142. That is effectively iOS-only right now: pdfCanRenderNatively
  starts true only on iOS, and Android falls back to “Open in external app” in src/
  components/editor/document/DocumentPanel.native.tsx:168.

  Two important implementation caveats:

  1. PDF split-view is not feature-parity with ePub. Position persistence and text-
     selection messaging are wired for ePub, but PDFs currently just render; Android PDF-
     in-panel is not implemented yet.
  2. The panel close button is wired to handleRemoveAttachment, not a pure “hide panel”
     action, in src/components/NoteEditorView.web.tsx:402 and src/components/
     NoteEditorView.native.tsx:398. So closing the split currently deletes the attachment
     and clears it from the note, rather than simply collapsing the viewer.

  There is also a persistence gap on mobile and in the shared editor persistence helper:
  src/services/notes/editorEntryPersistence.ts:8 does not include attachment, and src/
  services/storage/engines/MobileStorageEngine.ts:85 does not load parsed.attachment back
  into the Note. So the intended model is clear, but the current implementation does not
  fully preserve/reload attachments consistently across platforms.
