# Embedded Video Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed a YouTube (and generic) video panel inside the note editor, splitting the screen in half — video on one side, editor on the other — with playback position saved per video so users can resume where they left off.

**Architecture:** `videoUtils.ts` handles URL parsing and embed URL construction (including resume `start=N`). A new `videoPositionStore.ts` persists playback times to AsyncStorage, keyed by normalized URL. `EmbeddedVideoPanel` tracks the current time via WebView messages and saves it on close. `NoteEditorView` uses a flex-based split so both panels always share the available screen space equally.

**Tech Stack:** React Native + Expo, `react-native-webview`, `@react-native-async-storage/async-storage`, React Native Testing Library (`jest-expo`)

---

## What Is Already Implemented (scaffolding in this workspace)

These items are **done** — the code exists and tests pass. Do not re-implement them.

- `src/components/editor/video/videoUtils.ts` — `parseEmbeddedVideoUrl`, `getEmbeddedVideoLayout`
- `src/components/editor/video/EmbeddedVideoPanel.tsx` — panel UI with header, close, and side-layout resize (+/-)
- `src/components/NoteEditorView.tsx` — video modal, state wiring, `EmbeddedVideoPanel` rendered in stacked/side layouts
- `src/components/editor/video/__tests__/videoUtils.test.ts` — unit tests for URL parsing and layout detection
- `src/components/__tests__/NoteEditorView.jest.test.tsx` — integration test for opening/closing video panel

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/editor/video/videoUtils.ts` | Modify | Add `getResumeEmbedUrl(source, startSeconds)` |
| `src/components/editor/video/videoPositionStore.ts` | Create | AsyncStorage-backed position store keyed by URL |
| `src/components/editor/video/EmbeddedVideoPanel.tsx` | Modify | Time tracking via WebView messages; report position on close |
| `src/components/NoteEditorView.tsx` | Modify | Flex-based split layout; stacked resize ratio; load saved position on open |
| `src/components/editor/video/__tests__/videoUtils.test.ts` | Modify | Add test for `getResumeEmbedUrl` |
| `src/components/editor/video/__tests__/videoPositionStore.test.ts` | Create | Unit tests for save/load/clear |
| `src/components/editor/video/__tests__/EmbeddedVideoPanel.jest.test.tsx` | Create | Component render and close-callback tests |

---

## Task 1: `getResumeEmbedUrl` in videoUtils

**Files:**
- Modify: `src/components/editor/video/videoUtils.ts`
- Modify: `src/components/editor/video/__tests__/videoUtils.test.ts`

Adds a function that takes an `EmbeddedVideoSource` and a start time in seconds, returning a new embed URL with `&start=N` appended (YouTube) or a `#t=N` fragment (generic). This is the only entry point for resume logic in URL construction; everything else reads from the store.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/editor/video/__tests__/videoUtils.test.ts
import { getResumeEmbedUrl, parseEmbeddedVideoUrl } from "../videoUtils";

it("appends start parameter to a YouTube embed url when a resume time is given", () => {
  const source = parseEmbeddedVideoUrl(
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  )!;
  expect(getResumeEmbedUrl(source, 42)).toBe(
    "https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&enablejsapi=1&start=42",
  );
});

it("appends time fragment to a generic embed url", () => {
  const source = parseEmbeddedVideoUrl("https://example.com/video.mp4")!;
  expect(getResumeEmbedUrl(source, 90)).toBe(
    "https://example.com/video.mp4#t=90",
  );
});

it("returns the base embed url unchanged when start time is 0 or below", () => {
  const source = parseEmbeddedVideoUrl(
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  )!;
  expect(getResumeEmbedUrl(source, 0)).toBe(
    "https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&enablejsapi=1",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="videoUtils" --passWithNoTests
```

Expected: FAIL — `getResumeEmbedUrl is not a function`

- [ ] **Step 3: Implement `getResumeEmbedUrl` and update the base YouTube embed URL**

Also update `parseEmbeddedVideoUrl` to include `enablejsapi=1` in the YouTube embed URL so the IFrame API is available:

```ts
// In parseEmbeddedVideoUrl, update YouTube embed URL:
embedUrl: `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&enablejsapi=1`,

// New export at bottom of file:
export function getResumeEmbedUrl(
  source: EmbeddedVideoSource,
  startSeconds: number,
): string {
  if (startSeconds <= 0) {
    return source.embedUrl;
  }
  const start = Math.floor(startSeconds);
  if (source.kind === "youtube") {
    return `${source.embedUrl}&start=${start}`;
  }
  return `${source.embedUrl}#t=${start}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="videoUtils"
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/video/videoUtils.ts \
        src/components/editor/video/__tests__/videoUtils.test.ts
git commit -m "feat(video): add getResumeEmbedUrl for start-time resume support"
```

---

## Task 2: `videoPositionStore` — persist playback position

**Files:**
- Create: `src/components/editor/video/videoPositionStore.ts`
- Create: `src/components/editor/video/__tests__/videoPositionStore.test.ts`

A thin wrapper around AsyncStorage that saves/loads the last-known playback position (in seconds) for a given video URL. The URL is the canonical `rawUrl` from `EmbeddedVideoSource`.

- [ ] **Step 1: Create the test file with failing tests**

```ts
// src/components/editor/video/__tests__/videoPositionStore.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearVideoPosition,
  getVideoPosition,
  saveVideoPosition,
} from "../videoPositionStore";

// AsyncStorage is auto-mocked by jest-expo
beforeEach(() => {
  jest.clearAllMocks();
});

it("saves and retrieves a playback position for a url", async () => {
  await saveVideoPosition("https://www.youtube.com/watch?v=abc", 123.4);
  const pos = await getVideoPosition("https://www.youtube.com/watch?v=abc");
  expect(pos).toBeCloseTo(123.4);
});

it("returns 0 for a url with no stored position", async () => {
  const pos = await getVideoPosition("https://www.youtube.com/watch?v=new");
  expect(pos).toBe(0);
});

it("overwrites a previously saved position", async () => {
  await saveVideoPosition("https://example.com/v", 10);
  await saveVideoPosition("https://example.com/v", 99.9);
  const pos = await getVideoPosition("https://example.com/v");
  expect(pos).toBeCloseTo(99.9);
});

it("clears the stored position for a url", async () => {
  await saveVideoPosition("https://example.com/v", 55);
  await clearVideoPosition("https://example.com/v");
  const pos = await getVideoPosition("https://example.com/v");
  expect(pos).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="videoPositionStore"
```

Expected: FAIL — `cannot find module '../videoPositionStore'`

- [ ] **Step 3: Implement videoPositionStore**

```ts
// src/components/editor/video/videoPositionStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "keeper:video_position:";

function storageKey(rawUrl: string): string {
  return `${STORAGE_PREFIX}${rawUrl}`;
}

export async function saveVideoPosition(
  rawUrl: string,
  seconds: number,
): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(rawUrl), String(seconds));
  } catch {
    // Ignore write failures silently — position tracking is best-effort
  }
}

export async function getVideoPosition(rawUrl: string): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(storageKey(rawUrl));
    if (value === null) return 0;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function clearVideoPosition(rawUrl: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(rawUrl));
  } catch {
    // Ignore
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="videoPositionStore"
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/video/videoPositionStore.ts \
        src/components/editor/video/__tests__/videoPositionStore.test.ts
git commit -m "feat(video): add videoPositionStore for AsyncStorage-backed playback resume"
```

---

## Task 3: `EmbeddedVideoPanel` — time tracking and position callbacks

**Files:**
- Modify: `src/components/editor/video/EmbeddedVideoPanel.tsx`
- Create: `src/components/editor/video/__tests__/EmbeddedVideoPanel.jest.test.tsx`

The panel injects a small polling script into the WebView (native) or listens to `window.message` events (web) to track the current playback time. When closed, it calls a new `onTimeUpdate` callback so the parent can persist the position. It also accepts a `startSeconds` prop that controls `getResumeEmbedUrl`.

**Props change:**
```ts
interface EmbeddedVideoPanelProps {
  source: EmbeddedVideoSource;
  layout: EmbeddedVideoLayout;
  startSeconds?: number;          // NEW — seek to this position on load
  onClose: () => void;
  onTimeUpdate?: (seconds: number) => void;  // NEW — called periodically + on close
  onShrink?: () => void;
  onGrow?: () => void;
}
```

**Time tracking approach:**
- YouTube: the IFrame API (enabled by `enablejsapi=1`) broadcasts `postMessage` events from the iframe to `window`. The message payload for time updates is `JSON.parse(data)` where `info.currentTime` holds the value.
- On **web** (iframe): attach `window.addEventListener('message', ...)` in a `useEffect`.
- On **native** (WebView): inject JavaScript that polls `document.querySelector('video')?.currentTime` every 3 seconds and calls `window.ReactNativeWebView.postMessage(...)`. Handle via WebView `onMessage` prop.

Write the test first.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/editor/video/__tests__/EmbeddedVideoPanel.jest.test.tsx
import { EmbeddedVideoPanel } from "@/components/editor/video/EmbeddedVideoPanel";
import type { EmbeddedVideoSource } from "@/components/editor/video/videoUtils";
import { render, screen } from "@testing-library/react-native";
import { fireEvent } from "@testing-library/react-native";

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: ({ testID }: { testID?: string }) =>
      React.createElement(View, { testID: testID ?? "webview" }),
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    MaterialIcons: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock("@/hooks/useExtendedTheme", () => ({
  useExtendedTheme: () => ({
    colors: {
      background: "#fff",
      border: "#ccc",
      card: "#f9f9f9",
      text: "#111",
      textMuted: "#888",
    },
    custom: { editor: { placeholder: "#aaa" } },
  }),
}));

const youtubeSource: EmbeddedVideoSource = {
  rawUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  embedUrl:
    "https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&enablejsapi=1",
  host: "youtube.com",
  label: "YouTube video",
  kind: "youtube",
};

it("renders the video label", () => {
  render(
    <EmbeddedVideoPanel
      layout="stacked"
      onClose={() => {}}
      source={youtubeSource}
    />,
  );
  expect(screen.getByText("YouTube video")).toBeTruthy();
});

it("calls onClose when the close button is pressed", () => {
  const onClose = jest.fn();
  render(
    <EmbeddedVideoPanel
      layout="stacked"
      onClose={onClose}
      source={youtubeSource}
    />,
  );
  fireEvent.press(screen.getByLabelText("Close video panel"));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("shows resize buttons only in side layout", () => {
  const { rerender } = render(
    <EmbeddedVideoPanel
      layout="side"
      onClose={() => {}}
      source={youtubeSource}
    />,
  );
  expect(screen.getByLabelText("Shrink video panel")).toBeTruthy();
  expect(screen.getByLabelText("Expand video panel")).toBeTruthy();

  rerender(
    <EmbeddedVideoPanel
      layout="stacked"
      onClose={() => {}}
      source={youtubeSource}
    />,
  );
  expect(screen.queryByLabelText("Shrink video panel")).toBeNull();
  expect(screen.queryByLabelText("Expand video panel")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="EmbeddedVideoPanel"
```

Expected: FAIL — tests can't find the component or assertions fail

- [ ] **Step 3: Run tests to verify they now pass (existing component should already satisfy most of these)**

If some already pass, note which assertions fail and fix `EmbeddedVideoPanel` accordingly. The main change here is adding `onTimeUpdate` and `startSeconds` props without breaking the existing render.

Update `EmbeddedVideoPanel.tsx`:

```tsx
// Add to imports
import { getResumeEmbedUrl } from "./videoUtils";

// Updated props
interface EmbeddedVideoPanelProps {
  source: EmbeddedVideoSource;
  layout: EmbeddedVideoLayout;
  startSeconds?: number;
  onClose: () => void;
  onTimeUpdate?: (seconds: number) => void;
  onShrink?: () => void;
  onGrow?: () => void;
}

// Inside component, before return:
const currentTimeRef = useRef(0);

// Web: listen for YouTube postMessage events
useEffect(() => {
  if (Platform.OS !== "web") return;
  function handleMessage(event: MessageEvent) {
    try {
      const data =
        typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (
        data?.event === "infoDelivery" &&
        typeof data?.info?.currentTime === "number"
      ) {
        currentTimeRef.current = data.info.currentTime;
        onTimeUpdate?.(data.info.currentTime);
      }
    } catch {
      // ignore malformed messages
    }
  }
  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}, [onTimeUpdate]);

// Native: inject a polling script into the WebView
const INJECT_TIME_POLLER = `
(function() {
  var lastTime = -1;
  setInterval(function() {
    var v = document.querySelector('video');
    if (v && Math.abs(v.currentTime - lastTime) > 0.5) {
      lastTime = v.currentTime;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'timeUpdate',
        time: v.currentTime
      }));
    }
  }, 3000);
})();
true;
`;

function handleWebViewMessage(event: { nativeEvent: { data: string } }) {
  try {
    const msg = JSON.parse(event.nativeEvent.data);
    if (msg.type === "timeUpdate" && typeof msg.time === "number") {
      currentTimeRef.current = msg.time;
      onTimeUpdate?.(msg.time);
    }
  } catch {
    // ignore
  }
}

// Compute the actual embed URL with optional resume start
const activeEmbedUrl =
  startSeconds && startSeconds > 0
    ? getResumeEmbedUrl(source, startSeconds)
    : source.embedUrl;

// In JSX, pass injectedJavaScript and onMessage to WebView:
<WebView
  allowsFullscreenVideo
  allowsInlineMediaPlayback
  injectedJavaScript={INJECT_TIME_POLLER}
  mediaPlaybackRequiresUserAction={false}
  onMessage={handleWebViewMessage}
  source={{ uri: activeEmbedUrl }}
  style={styles.webView}
/>
```

- [ ] **Step 4: Run all video tests to verify they pass**

```bash
npm test -- --testPathPattern="video|EmbeddedVideoPanel"
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/video/EmbeddedVideoPanel.tsx \
        src/components/editor/video/__tests__/EmbeddedVideoPanel.jest.test.tsx
git commit -m "feat(video): add time tracking and resume-start support to EmbeddedVideoPanel"
```

---

## Task 4: Split-screen layout in NoteEditorView

**Files:**
- Modify: `src/components/NoteEditorView.tsx`
- Modify: `src/components/__tests__/NoteEditorView.jest.test.tsx`

**Current problem:** The stacked layout just appends the panel above the editor inside a scrollable View with a fixed `minHeight`. The video never truly takes half the screen — it's a card that pushes content down.

**Target layout (stacked):**
```
Screen (flex: 1)
  ├─ Title + metadata (fixed height, no scrolling)
  └─ Split container (flex: 1, flexDirection: "column")
       ├─ EmbeddedVideoPanel (flex: splitRatio, default 0.45)
       └─ EditorPane (flex: 1 - splitRatio)
```

**Target layout (side, already close):**
```
Screen (flex: 1)
  ├─ Title + metadata (fixed height)
  └─ Side container (flex: 1, flexDirection: "row")
       ├─ EditorPane (flex: 1)
       └─ EmbeddedVideoPanel (fixed width, resizable)
```

The metadata section needs to move outside the `ScrollView`/`View` that wraps the editor so it stays fixed at the top while only the editor area flex-fills the remaining space.

**New state:**
- `stackedSplitRatio` — number, default `0.45`, range [0.25, 0.65], adjusted by +/- buttons (step 0.05)
- `savedPosition` — number | null — loaded from `videoPositionStore` when a video is opened

**Position save/load flow:**
1. When user presses "Open video" and a URL is successfully parsed → load saved position from store → pass as `startSeconds` to the panel
2. `onTimeUpdate` callback updates a ref with the latest time
3. On `handleCloseVideo` → save the ref value to the store before clearing `embeddedVideo`
4. On `handleBackPress` (navigate away) → save the ref value to the store if a video is open

- [ ] **Step 1: Write the failing test for position persistence**

Add to `NoteEditorView.jest.test.tsx`:

```tsx
// Add mocks at top level of test file:
const mockSaveVideoPosition = jest.fn();
const mockGetVideoPosition = jest.fn();

jest.mock("@/components/editor/video/videoPositionStore", () => ({
  saveVideoPosition: (...args: unknown[]) => mockSaveVideoPosition(...args),
  getVideoPosition: (...args: unknown[]) => mockGetVideoPosition(...args),
}));

// In beforeEach, add these resets so existing tests still pass:
//   mockGetVideoPosition.mockReset();
//   mockSaveVideoPosition.mockReset();
//   mockGetVideoPosition.mockResolvedValue(0);
//   mockSaveVideoPosition.mockResolvedValue(undefined);
// (handleSubmitVideoUrl is now async and calls getVideoPosition)

// New test:
it("saves playback position when the video panel is closed", async () => {
  const user = userEvent.setup();
  mockGetVideoPosition.mockResolvedValue(0);
  mockSaveVideoPosition.mockResolvedValue(undefined);

  renderNoteEditor(makeNote());

  await screen.findByText("Toolbar");
  await user.press(screen.getByText("Open video"));
  await screen.findByText("Paste video URL");
  await user.type(
    screen.getByTestId("video-url-input"),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  await user.press(screen.getAllByText("Open video")[1]);
  await screen.findByTestId(/embedded-video-panel/);

  // Simulate time progressing (call onTimeUpdate via panel)
  // Close the panel
  await user.press(screen.getByText("Close video"));

  await waitFor(() => {
    expect(mockSaveVideoPosition).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      expect.any(Number),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify the new test fails (save not called yet)**

```bash
npm test -- --testPathPattern="NoteEditorView"
```

Expected: new test FAIL — `mockSaveVideoPosition` not called

- [ ] **Step 3: Implement split-screen layout and position wiring**

Key changes to `NoteEditorView.tsx`:

```tsx
// New imports
import {
  getVideoPosition,
  saveVideoPosition,
} from "@/components/editor/video/videoPositionStore";
import { getResumeEmbedUrl } from "@/components/editor/video/videoUtils";

// New state
const [stackedSplitRatio, setStackedSplitRatio] = useState(0.45);
const [videoStartSeconds, setVideoStartSeconds] = useState(0);
const latestVideoTimeRef = useRef(0);

// Updated handleSubmitVideoUrl — load saved position:
const handleSubmitVideoUrl = useCallback(async () => {
  const parsed = parseEmbeddedVideoUrl(videoInput);
  if (!parsed) {
    showToast("Enter a valid video URL");
    return;
  }
  const savedTime = await getVideoPosition(parsed.rawUrl);
  setVideoStartSeconds(savedTime);
  latestVideoTimeRef.current = savedTime;
  setEmbeddedVideo(parsed);
  setIsVideoModalVisible(false);
  showToast(`Opened ${parsed.label}`);
}, [showToast, videoInput]);

// Updated handleCloseVideo — save position:
const handleCloseVideo = useCallback(async () => {
  if (embeddedVideo) {
    await saveVideoPosition(embeddedVideo.rawUrl, latestVideoTimeRef.current);
  }
  setEmbeddedVideo(null);
}, [embeddedVideo]);

// Updated handleBackPress — save position before navigating:
const handleBackPress = useCallback(async () => {
  if (embeddedVideo) {
    await saveVideoPosition(embeddedVideo.rawUrl, latestVideoTimeRef.current);
  }
  await persistCurrentEntry();
  router.back();
}, [persistCurrentEntry, router, embeddedVideo]);

// Stacked resize handlers
const handleIncreaseStackedRatio = useCallback(() => {
  setStackedSplitRatio((r) => Math.min(r + 0.05, 0.65));
}, []);
const handleDecreaseStackedRatio = useCallback(() => {
  setStackedSplitRatio((r) => Math.max(r - 0.05, 0.25));
}, []);

// Updated editorPane rendering (no change to editorPane const)
// Replace the stacked+side rendering block:
const videoAndEditorBlock =
  embeddedVideo && videoLayout === "side" ? (
    <View style={styles.sideBySideShell}>
      <View style={styles.editorPane}>{editorPane}</View>
      <View style={{ width: desktopVideoPanelWidth }}>
        <EmbeddedVideoPanel
          layout={videoLayout}
          onClose={() => void handleCloseVideo()}
          onGrow={handleIncreasePanelWidth}
          onShrink={handleDecreasePanelWidth}
          onTimeUpdate={(t) => { latestVideoTimeRef.current = t; }}
          source={embeddedVideo}
          startSeconds={videoStartSeconds}
        />
      </View>
    </View>
  ) : embeddedVideo && videoLayout === "stacked" ? (
    <View style={styles.stackedSplitShell}>
      <View style={{ flex: stackedSplitRatio }}>
        <EmbeddedVideoPanel
          layout={videoLayout}
          onClose={() => void handleCloseVideo()}
          onGrow={handleIncreaseStackedRatio}
          onShrink={handleDecreaseStackedRatio}
          onTimeUpdate={(t) => { latestVideoTimeRef.current = t; }}
          source={embeddedVideo}
          startSeconds={videoStartSeconds}
        />
      </View>
      <View style={{ flex: 1 - stackedSplitRatio }}>{editorPane}</View>
    </View>
  ) : (
    editorPane
  );
```

Add `stackedSplitShell` style:

```ts
stackedSplitShell: {
  flex: 1,
  flexDirection: "column",
  gap: 8,
  minHeight: 0,
},
```

Remove the now-redundant `embeddedVideo && videoLayout === "stacked"` block from the JSX (it was inlined before `editorPane`). Replace it with `{videoAndEditorBlock}` in the outer View.

- [ ] **Step 4: Run all NoteEditorView tests**

```bash
npm test -- --testPathPattern="NoteEditorView"
```

Expected: all tests pass, including the new position-save test

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: all 108+ tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/NoteEditorView.tsx \
        src/components/__tests__/NoteEditorView.jest.test.tsx
git commit -m "feat(video): split-screen layout and playback position persistence"
```

---

## Task 5: Update roadmap and planning docs

**Files:**
- Modify: `ROADMAP.md`
- Modify: `TODO.md`
- Modify: `BUGS.md`

- [ ] **Step 1: Mark "Embedded Video Player" as implemented in ROADMAP.md**

Move the Embedded Video Player section from "Feature Backlog" into a new "Phase 7: Embedded Video Player ✅" section. Document:
- Stacked (mobile) and side (desktop) split-screen layouts
- YouTube URL parsing and generic embed fallback
- Playback position persistence via AsyncStorage
- Resume from last watched position on re-open
- Key files

- [ ] **Step 2: Update TODO.md quick reference**

Add a line noting Phase 7 complete and what remains (manual validation on device).

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md TODO.md BUGS.md
git commit -m "docs: mark embedded video player as shipped, update roadmap"
```

---

## Running All Tests (Final Verification)

```bash
npm test
npm run lint
```

Expected: all tests green, no lint errors.

---

## Manual Validation Checklist

These can't be automated but should be verified on device before calling the feature done:

- [ ] Mobile (iOS/Android): video opens in stacked layout, takes ~half screen height
- [ ] Mobile: +/- resize buttons adjust the split ratio
- [ ] Mobile: navigating back saves position; reopening same URL resumes from that time
- [ ] Desktop (Tauri/web): video opens in side layout
- [ ] Desktop: +/- resize buttons adjust panel width
- [ ] Desktop: position saves on close and resumes on re-open
- [ ] Both: entering an invalid URL shows toast, does not open panel
- [ ] Both: "Change video" reopens the URL modal pre-filled with the current URL
