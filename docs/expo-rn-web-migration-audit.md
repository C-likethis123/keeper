# Expo/RN web migration audit

Scope: `src/`, root Expo/test configuration, and `package.json`, inspected 2026-09-19 and updated 2026-09-26 after desktop removal.

## Result

The original audit found **129 direct Expo, React Native, React Navigation, and RNTL import occurrences** in `src/`, plus Expo/Jest configuration. Desktop support has since been removed; `src/**/*.web.ts(x)` now targets browsers only.

## Complete import inventory

Each package below is every distinct Expo/RN-family import found in executable source. File lists are exhaustive for production source; test locations are grouped by test-suite glob where they use the same package.

| Import | Production locations | Test locations |
| --- | --- | --- |
| `expo-router` | `src/app/{_layout.web,index,editor,suggested-mocs}.tsx`, `src/app/auth/callback.tsx`, `src/components/{NoteCard,NoteEditorView,TabBar}.tsx`, `src/components/drawing/DrawingEditorView.tsx`, `src/hooks/useCreateAndOpenNote.ts` | `src/app/__tests__/{editor,index}.jest.test.tsx`; `src/components/__tests__/{NoteCard,NoteEditorView,TabBar}.jest.test.tsx` |
| `expo-router/drawer` | `src/app/_layout.web.tsx` | — |
| `expo-router/html` | `src/app/+html.tsx` | — |
| `expo-router/testing-library` | — | `src/app/__tests__/editor.jest.test.tsx`, `src/components/__tests__/NoteEditorView.jest.test.tsx` |
| `expo/dom` | `src/components/editor/lexical/LexicalMarkdownEditor.tsx` | — |
| `expo-file-system` | `src/services/notes/{Notes,attachmentStorage,clusterFeedbackService,clusterService,imageStorage}.ts`, `src/services/notes/indexDb/{mapper,rebuildService}.ts`, `src/services/storage/engines/StorageEngine.ts` | `src/services/notes/indexDb/__tests__/repository.test.ts` (type) and `jest.setup.ts` (mock) |
| `expo-sqlite` | `src/services/notes/indexDb/{db,rebuildService,repository}.ts`, `src/migrations/001_init.ts` through `008_add_super_clusters.ts` | `src/services/notes/indexDb/__tests__/repository.test.ts` (type) |
| `expo-document-picker` | `src/components/noteEditorFilePickers.ts` | `src/components/__tests__/NoteEditorView.jest.test.tsx` (mock) |
| `expo-image` | `src/components/editor/lexical/image/ImageComponent.tsx` | — |
| `@expo/vector-icons` | `src/components/{AttachVideoModal,FilterDrawerContent,HomeQuickComposer,NoteCard,NoteEditorHeader,NoteGrid,NoteHistoryModal,PwaInstallButton,SaveIndicator,TabBar,TemplatePickerModal}.tsx`, `src/components/{shared/EmptyState,shared/ErrorScreen,shared/IconButton,shared/SearchBar}.tsx`, `src/components/{drawing/DrawingToolbar,editor/document/DocumentPanel.shared,editor/lexical/toolbar/LexicalToolbarExtension,editor/video/VideoSplitPanel,moc/NoteRelatedNotes}.tsx` | — |
| `react-native` | `src/app/{_layout.web,index,editor,suggested-mocs}.tsx`; `src/components/` UI files: `AttachVideoModal`, `FilterDrawerContent`, `HomeQuickComposer`, `HomeScreenHeader`, `NoteCard`, `NoteEditorHeader`, `NoteEditorView`, `NoteGrid`, `NoteHistoryModal`, `PwaInstallButton`, `SaveIndicator`, `TabBar`, `TemplatePickerModal`; all `src/components/shared/*` except no-import files; `src/components/{drawing/*,editor/{EditorSidePanelHost,document/*,video/*},editor/lexical/{equations/MathView,slashCommand/SlashCommandOverlay,toolbar/LexicalToolbarExtension,wikilinks/WikiLinkOverlay},moc/*}.tsx`; `src/hooks/{useAutoSave,useEditorKeyboardHeight,useNoteEditorLayout}.ts`; `src/constants/themes/types.ts` | All `src/**/*.{test,jest.test}.{ts,tsx}` suites listed above that render RN components; see reproducible command below for each line |
| `react-native-gesture-handler` | `src/app/_layout.web.tsx`, `src/components/drawing/DrawingCanvasSkia.tsx` | `src/app/__tests__/_layout.web.jest.test.tsx`; `jest.setup.ts` |
| `react-native-safe-area-context` | `src/app/_layout.web.tsx`, `src/app/suggested-mocs.tsx`, `src/components/{FilterDrawerContent,HomeScreenHeader,NoteEditorHeader,NoteEditorView,NoteHistoryModal}.tsx`, `src/components/drawing/DrawingToolbar.tsx` | layout, index, filter-drawer, and editor test suites |
| `react-native-svg` | `src/components/drawing/DrawingPreview.tsx` | — |
| `react-native-mathjax-html-to-svg` | `src/components/editor/lexical/equations/MathView.tsx` | — |
| `@shopify/react-native-skia` | `src/components/drawing/DrawingCanvasSkia.tsx` | `jest.setup.ts` (mock) |
| `@react-native-async-storage/async-storage` | `src/services/{notes/crdtNoteService,sync/syncStateStorage}.ts`, `src/hooks/useNoteEditorLayout.ts` | `jest.setup.ts` (mock); CRDT and sync test suites |
| `@react-navigation/native` | `src/app/_layout.web.tsx`, `src/app/{index,suggested-mocs}.tsx` (types), `src/components/editor/lexical/LexicalMarkdownEditor.tsx`, `src/constants/themes/{darkTheme,lightTheme,types}.ts`, `src/hooks/useExtendedTheme.ts` | layout test suite |
| `@react-navigation/drawer` | `src/app/{index,suggested-mocs}.tsx`, `src/components/FilterDrawerContent.tsx` | drawer-content suite |
| `@testing-library/react-native` | — | `src/app/__tests__/*`, `src/components/**/__tests__/*`, `src/hooks/__tests__/*` (19 suites) |

Also Expo tooling/configuration imports or references: `metro.config.js` (`expo/metro-config`), `app.config.js` (`expo-router` plugin), `babel.config.js` (`babel-preset-expo`), `jest.config.js` (`jest-expo`), `package.json` (`expo-router/entry`, Expo scripts and dependencies).

Reproduce exact source-level locations:

```sh
rg -n --glob '*.{ts,tsx,js,jsx}' \
  'from ["'"'](?:expo|react-native|@react-navigation|@testing-library/react-native|jest-expo)' src jest.setup.ts
```

## Replacement map

| Current surface | Replacement | Main migration targets |
| --- | --- | --- |
| Expo Router / React Navigation / Drawer | `react-router-dom`: `createBrowserRouter` or `BrowserRouter`, `Routes`, `Link`, `useNavigate`, `useParams`, `Navigate` | Replace file routing in `src/app/`; move drawer state/layout into root React layout; replace router calls and navigation theme hooks. |
| RN components (`View`, `Text`, `Pressable`, `ScrollView`, `FlatList`, `TextInput`, `Modal`, `StyleSheet`) | Semantic DOM (`div`, `button`, `main`, `input`, `dialog`) plus CSS modules/plain CSS | Nearly all `src/components/` and app routes. Replace `Platform`, safe areas, keyboard, app-state, dimensions, pan responder, and animated APIs with browser equivalents. |
| Expo file APIs (`expo-file-system`) | IndexedDB for note/blob persistence; File System Access API only when user grants a directory/file handle; object URLs for display | Replace shared implementation in `StorageEngine.ts` and all direct file-service callers. Keep existing storage interface to contain migration. |
| Expo SQLite | IndexedDB (`idb` is a practical wrapper); implement search/index records and migrations over object stores | `src/services/notes/indexDb/*`, `src/migrations/*`. Do not attempt to directly translate SQLite SQL; define stores/indexes and a one-time data migration. |
| Expo document/image pickers | `<input type="file">` and `showOpenFilePicker()` when available | `noteEditorFilePickers.ts`; browser path already exists in `noteEditorFilePickers.web.ts`. |
| `expo-image` | `<img>` with `onLoad`, CSS sizing/object-fit, and loading/decoding attributes | `ImageComponent.tsx`. |
| Expo Vector Icons | `lucide-react`, inline SVG, or existing icon font served by CSS | UI icon call sites listed above. |
| RN SVG / Skia / MathJax bridge | Browser SVG/canvas; use KaTeX already installed for math | Drawing screens need separate port; `DrawingCanvasSkia.tsx` is highest-risk UI conversion. |
| AsyncStorage | IndexedDB, preferably behind small `KeyValueStore` adapter | CRDT/sync state and layout preference. |
| Jest Expo + RNTL | Vitest + `@testing-library/react` + `@testing-library/user-event`, with jsdom | Replace `jest.config.js`, `jest.setup.ts`, test scripts, RN mocks, `renderRouter`, and RNTL queries/events. |

## Desktop removal

Desktop shell, Rust storage core, desktop build scripts/dependencies, runtime detection, command bridge, and desktop-specific attachment branches were removed on 2026-09-26. Browser storage, index, attachment, image, picker, and startup paths now use browser APIs directly.

## Suggested conversion order

1. Create React Router shell and DOM root layout; preserve route paths and URL parameters.
2. Port shared UI primitives and screens to DOM/CSS, including drawer layout.
3. Introduce browser IndexedDB storage and index adapters; migrate picker/image attachment paths.
4. Port drawing/math/SVG and platform-specific hooks.
5. Convert tests to Vitest/RTL; remove Expo/RN dependencies only after browser build and tests pass.
