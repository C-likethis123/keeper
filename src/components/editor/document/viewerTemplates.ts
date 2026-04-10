import { EPUB_JS } from "./epubJsBundle";
import { PDF_JS } from "./pdfJsBundle";

/**
 * Build the HTML string for the ePub viewer WebView.
 *
 * The viewer:
 * - Receives an init message: { type: 'open', fileUri: string, cfi?: string, theme: 'light'|'dark' }
 * - Sends messages back:
 *   { type: 'cfi', cfi: string }   — on every page turn (for position persistence)
 *   { type: 'textSelected', text: string } — when the user selects text
 */
export function buildEpubViewerHtml(
	theme: "light" | "dark",
	epubBase64?: string | null,
	initialCfi?: string | null,
): string {
	const bg = theme === "dark" ? "#1a1a1a" : "#ffffff";
	const fg = theme === "dark" ? "#e0e0e0" : "#1a1a1a";

	// Embed the base64 and CFI as JSON so the script can auto-open without
	// any async message passing (avoids timing/origin issues in WebView).
	const autoOpenScript = epubBase64
		? `
  var EPUB_BASE64 = ${JSON.stringify(epubBase64)};
  var INITIAL_CFI = ${JSON.stringify(initialCfi ?? null)};
  openBook(EPUB_BASE64, INITIAL_CFI, '${theme}', true);`
		: "";

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
  #location-bar {
    position: fixed; bottom: 0; left: 0; right: 0;
    text-align: center; padding: 6px 0;
    font-size: 12px; color: ${fg};
    background: rgba(0,0,0,0.3);
    z-index: 10;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  #location-bar.visible { opacity: 1; }
  .error { color: #e74c3c; padding: 20px; font-family: sans-serif; }
</style>
</head>
<body>
<div id="viewer"></div>
<button id="prev" aria-label="Previous page">‹</button>
<button id="next" aria-label="Next page">›</button>
<div id="location-bar"></div>
<script>
${EPUB_JS}
</script>
<script>
(function() {
  var book = null;
  var rendition = null;
  var renditionReady = false;
  var totalLocations = 0;
  var locationsGenerated = false;

  function postMsg(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } else if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(msg), '*');
    }
  }

  function updateLocationDisplay() {
    if (!rendition || !renditionReady || !locationsGenerated) return;
    var locationBar = document.getElementById('location-bar');
    if (!locationBar) return;
    var cfi = rendition.currentLocation();
    if (cfi && typeof cfi === 'object' && cfi.start) {
      var loc = book.locations.locationFromCfi(cfi.start);
      if (loc !== null && loc !== undefined) {
        var label = (loc + 1) + ' / ' + totalLocations;
        locationBar.textContent = label;
        locationBar.classList.add('visible');
        postMsg({ type: 'location', label: label, current: loc + 1, total: totalLocations });
      }
    }
  }

  // Tap to toggle location bar visibility
  var locationBarVisible = false;
  document.getElementById('viewer').addEventListener('click', function() {
    locationBarVisible = !locationBarVisible;
    var locationBar = document.getElementById('location-bar');
    if (locationBar) {
      if (locationBarVisible) locationBar.classList.add('visible');
      else locationBar.classList.remove('visible');
    }
  });

  function openBook(source, initialCfi, theme, isBase64) {
    renditionReady = false;
    try {
      book = isBase64
        ? ePub(source, { encoding: 'base64', replacements: 'base64' })
        : ePub(source);

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
          updateLocationDisplay();
        }
      });

      rendition.on('selected', function(cfiRange, contents) {
        var text = contents.window.getSelection().toString().trim();
        if (text) postMsg({ type: 'textSelected', text: text });
      });

      var display = initialCfi ? rendition.display(initialCfi) : rendition.display();
      display.then(function() {
        renditionReady = true;
        // Generate locations for the location display
        book.locations.generate(1024).then(function() {
          totalLocations = book.locations.total;
          locationsGenerated = totalLocations > 0;
          updateLocationDisplay();
        }).catch(function() {
          // locations generation failed, skip location display
        });
        postMsg({ type: 'ready' });
      }).catch(function(err) {
        postMsg({ type: 'error', message: 'display failed: ' + String(err) });
      });
    } catch(err) {
      document.body.innerHTML = '<div class="error">Failed to open ePub: ' + err.message + '</div>';
      postMsg({ type: 'error', message: 'openBook failed: ' + String(err) });
    }
  }

  document.getElementById('prev').addEventListener('click', function() {
    if (rendition && renditionReady) rendition.prev();
  });
  document.getElementById('next').addEventListener('click', function() {
    if (rendition && renditionReady) rendition.next();
  });

  // Keyboard navigation (desktop)
  document.addEventListener('keydown', function(e) {
    if (!rendition || !renditionReady) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') rendition.prev();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') rendition.next();
  });

  // Listen for messages from React Native or desktop parent frame
  window.addEventListener('message', function(event) {
    try {
      var msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (msg.type === 'open' && msg.fileUri) {
        openBook(msg.fileUri, msg.cfi || null, msg.theme || '${theme}', false);
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
    if (uri) openBook(decodeURIComponent(uri), cfi || undefined, '${theme}', false);
  }

  ${autoOpenScript}
})();
</script>
</body>
</html>`;
}

export function buildPdfViewerHtml(theme: "light" | "dark"): string {
	const bg = theme === "dark" ? "#101214" : "#eef1f4";
	const panel = theme === "dark" ? "#1b1f24" : "#ffffff";
	const fg = theme === "dark" ? "#f5f7fa" : "#16212b";
	const muted = theme === "dark" ? "#9aa6b2" : "#52606d";
	const border = theme === "dark" ? "#2e3742" : "#d9e2ec";
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: ${bg}; color: ${fg}; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  body { display: flex; flex-direction: column; }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid ${border};
    background: ${panel};
  }
  .toolbar-group { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .toolbar button {
    border: 1px solid ${border};
    background: ${bg};
    color: ${fg};
    border-radius: 999px;
    min-width: 36px;
    height: 36px;
    padding: 0 12px;
    font-size: 14px;
  }
  .toolbar button[disabled] { opacity: 0.45; }
  .page-label {
    font-size: 13px;
    color: ${muted};
    white-space: nowrap;
  }
  #viewer {
    flex: 1;
    overflow: auto;
    padding: 16px 12px 24px;
  }
  #canvas-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
  }
  canvas {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    background: white;
    box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
  }
  .empty, .error {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
    color: ${muted};
  }
  .error { color: #d64545; }
</style>
</head>
<body>
<div class="toolbar">
  <div class="toolbar-group">
    <button id="prev" type="button" aria-label="Previous page">Prev</button>
    <button id="next" type="button" aria-label="Next page">Next</button>
  </div>
  <div id="page-label" class="page-label">Open a PDF to start reading</div>
</div>
<div id="viewer">
  <div id="status" class="empty">Loading PDF viewer…</div>
  <div id="canvas-wrap" hidden>
    <canvas id="canvas"></canvas>
  </div>
</div>
<script type="module">
const PDF_JS_SOURCE = ${JSON.stringify(PDF_JS)};

(function () {
  const statusEl = document.getElementById('status');
  const canvasWrap = document.getElementById('canvas-wrap');
  const canvas = document.getElementById('canvas');
  const prevButton = document.getElementById('prev');
  const nextButton = document.getElementById('next');
  const pageLabel = document.getElementById('page-label');
  const viewer = document.getElementById('viewer');
  const ctx = canvas.getContext('2d', { alpha: false });

  let pdfModulePromise = null;
  let pdfDoc = null;
  let currentPage = 1;
  let renderTask = null;

  function postMsg(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } else if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(msg), '*');
    }
  }

  async function loadPdfModule() {
    if (!pdfModulePromise) {
      const moduleUrl = URL.createObjectURL(
        new Blob([PDF_JS_SOURCE], { type: 'text/javascript' })
      );
      pdfModulePromise = import(moduleUrl).finally(() => {
        URL.revokeObjectURL(moduleUrl);
      });
    }
    return pdfModulePromise;
  }

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.className = isError ? 'error' : 'empty';
    statusEl.hidden = false;
    canvasWrap.hidden = true;
  }

  function updateControls() {
    const pageCount = pdfDoc ? pdfDoc.numPages : 0;
    prevButton.disabled = !pdfDoc || currentPage <= 1;
    nextButton.disabled = !pdfDoc || currentPage >= pageCount;
    pageLabel.textContent = pdfDoc
      ? 'Page ' + currentPage + ' of ' + pageCount
      : 'Open a PDF to start reading';
  }

  async function renderPage(pageNumber) {
    if (!pdfDoc) {
      return;
    }
    currentPage = Math.max(1, Math.min(pageNumber, pdfDoc.numPages));
    updateControls();
    setStatus('Rendering page ' + currentPage + '…', false);
    try {
      if (renderTask) {
        renderTask.cancel();
      }
      const page = await pdfDoc.getPage(currentPage);
      const containerWidth = Math.max(viewer.clientWidth - 24, 240);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const outputScale = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';

      const transform = outputScale === 1
        ? null
        : [outputScale, 0, 0, outputScale, 0, 0];

      renderTask = page.render({
        canvasContext: ctx,
        viewport,
        transform,
      });
      await renderTask.promise;
      renderTask = null;
      statusEl.hidden = true;
      canvasWrap.hidden = false;
      viewer.scrollTop = 0;
      updateControls();
      postMsg({ type: 'page', page: String(currentPage) });
    } catch (error) {
      if (error && error.name === 'RenderingCancelledException') {
        return;
      }
      setStatus('Failed to render PDF page.', true);
      postMsg({ type: 'error', message: String(error) });
    }
  }

  async function openPdf(source, initialPage) {
    try {
      setStatus('Opening PDF…', false);
      const pdfjsLib = await loadPdfModule();
      const loadingTask = pdfjsLib.getDocument({
        url: source,
        disableWorker: true,
      });
      pdfDoc = await loadingTask.promise;
      currentPage = Number.parseInt(initialPage || '1', 10) || 1;
      await renderPage(currentPage);
    } catch (error) {
      setStatus('Failed to open PDF.', true);
      postMsg({ type: 'error', message: String(error) });
    }
  }

  prevButton.addEventListener('click', function () {
    if (pdfDoc && currentPage > 1) {
      renderPage(currentPage - 1);
    }
  });

  nextButton.addEventListener('click', function () {
    if (pdfDoc && currentPage < pdfDoc.numPages) {
      renderPage(currentPage + 1);
    }
  });

  window.addEventListener('resize', function () {
    if (pdfDoc) {
      renderPage(currentPage);
    }
  });

  window.addEventListener('message', function (event) {
    try {
      const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (msg.type === 'open' && msg.fileUri) {
        openPdf(msg.fileUri, msg.page);
      }
    } catch (error) {
      postMsg({ type: 'error', message: String(error) });
    }
  });
})();
</script>
</body>
</html>`;
}
