import { EPUB_JS } from "./epubJsBundle";

/**
 * Build the HTML string for the ePub viewer WebView.
 *
 * The viewer:
 * - Receives an init message: { type: 'open', fileUri: string, cfi?: string, theme: 'light'|'dark' }
 * - Sends messages back:
 *   { type: 'cfi', cfi: string }   — on every page turn (for position persistence)
 *   { type: 'textSelected', text: string } — when the user selects text
 */
export function buildEpubViewerHtml(theme: "light" | "dark"): string {
	const bg = theme === "dark" ? "#1a1a1a" : "#ffffff";
	const fg = theme === "dark" ? "#e0e0e0" : "#1a1a1a";

	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; background: ${bg}; color: ${fg}; overflow: hidden; }
  #viewer { width: 100%; height: 100%; }
  #prev, #next {
    position: fixed; top: 50%; transform: translateY(-50%);
    width: 40px; height: 60px; background: rgba(0,0,0,0.15);
    border: none; cursor: pointer; z-index: 10; font-size: 18px; color: ${fg};
    display: flex; align-items: center; justify-content: center; border-radius: 4px;
  }
  #prev { left: 0; }
  #next { right: 0; }
  .error { color: #e74c3c; padding: 20px; font-family: sans-serif; }
</style>
</head>
<body>
<div id="viewer"></div>
<button id="prev" aria-label="Previous page">‹</button>
<button id="next" aria-label="Next page">›</button>
<script>
${EPUB_JS}
</script>
<script>
(function() {
  var book = null;
  var rendition = null;

  function postMsg(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } else if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(msg), '*');
    }
  }

  function openBook(fileUri, initialCfi, theme) {
    try {
      book = ePub(fileUri);
      rendition = book.renderTo('viewer', {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
      });

      rendition.themes.register('light', { body: { background: '#ffffff', color: '#1a1a1a' } });
      rendition.themes.register('dark',  { body: { background: '#1a1a1a', color: '#e0e0e0' } });
      rendition.themes.select(theme || 'light');

      rendition.on('relocated', function(location) {
        if (location && location.start && location.start.cfi) {
          postMsg({ type: 'cfi', cfi: location.start.cfi });
        }
      });

      rendition.on('selected', function(cfiRange, contents) {
        var text = contents.window.getSelection().toString().trim();
        if (text) postMsg({ type: 'textSelected', text: text });
      });

      var display = initialCfi ? rendition.display(initialCfi) : rendition.display();
      display.catch(function(err) {
        postMsg({ type: 'error', message: String(err) });
      });
    } catch(err) {
      document.body.innerHTML = '<div class="error">Failed to open ePub: ' + err.message + '</div>';
      postMsg({ type: 'error', message: String(err) });
    }
  }

  document.getElementById('prev').addEventListener('click', function() {
    if (rendition) rendition.prev();
  });
  document.getElementById('next').addEventListener('click', function() {
    if (rendition) rendition.next();
  });

  // Keyboard navigation (desktop)
  document.addEventListener('keydown', function(e) {
    if (!rendition) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') rendition.prev();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') rendition.next();
  });

  // Listen for init message from React Native or iframe parent
  window.addEventListener('message', function(event) {
    try {
      var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (msg.type === 'open') {
        openBook(msg.fileUri, msg.cfi, msg.theme);
      } else if (msg.type === 'theme') {
        if (rendition) rendition.themes.select(msg.theme);
      }
    } catch(e) {}
  });

  // Auto-open if fileUri passed in hash (web/desktop iframe approach)
  if (window.location.hash && window.location.hash.length > 1) {
    var params = new URLSearchParams(window.location.hash.slice(1));
    var uri = params.get('uri');
    var cfi = params.get('cfi');
    if (uri) openBook(decodeURIComponent(uri), cfi || undefined, '${theme}');
  }
})();
</script>
</body>
</html>`;
}

/**
 * Build the HTML string for the PDF viewer on mobile.
 *
 * On iOS, WKWebView renders PDFs natively when given a file:// URI — so
 * this HTML just wraps an <embed> that falls back gracefully. On Android,
 * the <embed> won't render; the component will show an "Open externally"
 * fallback button instead.
 *
 * Note: Full PDF.js support (for Android and text-selection annotations) is
 * a follow-up. The PDF_JS bundle file is prepared by build-viewers.js for
 * future use.
 */
export function buildPdfViewerHtml(fileUri: string, theme: "light" | "dark"): string {
	const bg = theme === "dark" ? "#1a1a1a" : "#f5f5f5";
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: ${bg}; overflow: hidden; }
  embed { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
<embed src="${fileUri}" type="application/pdf" width="100%" height="100%">
</body>
</html>`;
}
