# PDF and EPUB attachments

Toolbar file input accepts PDF and EPUB, saves bytes through browser IndexedDB storage,
and stores `_attachments/...` path on note. Browser editor session persists attachment
metadata alongside Markdown.

`web/src/adapters/browser/editor/BrowserEditorSidePanelHost.tsx` owns split layout.
Document panel sits beside editor on wide screens and above editor on narrow screens.
Pointer and keyboard resizing clamp ratio to 25–75%; browser storage retains
`doc-split-ratio` across reloads.

`BrowserDocumentPanel.tsx` infers attachment type and renders shared
`src/components/editor/document/DocumentPanel.tsx`. Shared viewer state resolves local
bytes through attachment storage and renders PDF.js or EPUB viewer HTML inside iframe.
Viewer messages report text selections and document positions for persistence.

Dismiss behavior comes from browser editor session. Attachment removal and metadata
updates use browser attachment and note services. No native picker or WebView required.
