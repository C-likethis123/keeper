# App Bundle Size Investigation

**Target**: reduce from ~285 MB → well under 100 MB for a production arm64 APK
**Investigated with**: debug APK at `android/app/build/outputs/apk/debug/app-debug.apk` (208 MB) + production JS bundle analysis

---

## Summary of findings

| Root cause | Estimated saving | Effort |
|---|---|---|
| All 4 CPU ABIs built for every native lib | ~140 MB | Low — one gradle.properties line |
| `expo-dev-launcher` (ML Kit barcode) in production | ~20 MB | Low — exclude from release build |
| R8/minification disabled in release | ~15–25 MB dex | Low — one gradle.properties line |
| `react-syntax-highlighter` + full `highlight.js` | ~3–4 MB JS | Medium — swap to light build |
| `react-native-mathjax-html-to-svg` | ~1–2 MB JS | Low — already lazy-loaded |

---

## 1. Four CPU architectures (biggest win: ~140 MB)

**File**: `android/gradle.properties`

```
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```

Every native `.so` is compiled for all four ABIs. With 24 libs per ABI that means 96 `.so` files (188 MB total). The arm64-v8a slice alone is ~47 MB (debug/unstripped). A production build targeting only arm64-v8a drops native libs by roughly 75%.

**Fix for production** — change the line to:
```
reactNativeArchitectures=arm64-v8a
```

Keep `x86_64` locally if you use the emulator for debugging. Never ship x86/x86_64 to users.

Alternatively, enable ABI splits in `android/app/build.gradle` so Play Store delivers a per-ABI APK instead of a fat APK:
```groovy
android {
    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a", "armeabi-v7a"
            universalApk false
        }
    }
}
```

---

## 2. expo-dev-launcher ships in production (20 MB native + 880 KB models)

**Confirmed dependency chain:**
```
play-services-mlkit-barcode-scanning:18.3.1
  └── com.google.mlkit:barcode-scanning:17.3.0
        └── :expo-dev-launcher   ← declared in expo-dev-launcher/android/build.gradle
              └── :expo (autolinking)
```

`expo-dev-launcher` uses ML Kit barcode scanning to let developers scan QR codes to connect to the Expo dev server. It should never appear in production builds.

The ML Kit dependency contributes:
- `libbarhopper_v3.so` × 4 ABIs: ~20 MB
- 3 TFLite barcode models: 880 KB
- Associated dex code

**Fix** — `expo-dev-client` is currently in the main `dependencies` field in `package.json`. It should only be active in development builds. There are two approaches:

**Option A** — Expo's `expo-dev-client` plugin only activates in dev builds when `APP_VARIANT=development`. Confirm that the prod build script (`npm run android`) does NOT set this env var and that the `app.config.js` plugin list conditionally includes `expo-dev-client`:
```js
// app.config.js
plugins: [
  "expo-router",
  ...(IS_DEV ? ["expo-dev-client"] : []),
  // ...
]
```

**Option B** — Exclude the dependency explicitly in `android/app/build.gradle`:
```groovy
configurations.all {
    exclude group: "com.google.mlkit", module: "barcode-scanning"
}
```
This is a safety net but Option A (not linking the module at all) is cleaner.

---

## 3. R8 / minification disabled in release (~15–25 MB)

**File**: `android/gradle.properties`

`enableMinifyInReleaseBuilds` is not set, so `build.gradle`'s default of `false` applies. R8 dead-code elimination and bytecode minification are both off.

**Fix** — add to `android/gradle.properties`:
```
android.enableMinifyInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
```

Also ensure `android/app/proguard-rules.pro` keeps necessary React Native / Expo rules. The default `proguard-android.txt` base is already referenced; Expo's autolinking usually generates the right rules.

---

## 4. react-syntax-highlighter bundles all 189 highlight.js languages (3–4 MB JS)

**Files**:
- `src/components/editor/code/SyntaxHighlighter.tsx:12` — imports from `"react-syntax-highlighter"` (default, full build)
- `src/components/editor/code/SyntaxHighlighter.tsx:13` — imports `* as HLJSSyntaxStyles from "react-syntax-highlighter/dist/esm/styles/hljs"` (all styles)
- `src/components/editor/code/LanguageRegistry.ts:295` — `require("highlight.js")` (full build, synchronous)

Source map contribution:
- `react-syntax-highlighter`: 1,638 KB
- `highlight.js`: 1,505 KB
- `lowlight`: 1,358 KB (used by `react-syntax-highlighter` default)
- `refractor`: 958 KB (used by `react-syntax-highlighter` default)

**Total**: ~5.5 MB of source → ~3–4 MB in the minified bundle

**Fix** — switch `SyntaxHighlighter.tsx` to the light build and register only the languages defined in `LanguageRegistry`:

```ts
// SyntaxHighlighter.tsx
import Highlighter from "react-syntax-highlighter/dist/esm/light";

// Register only the languages you actually support
import javascript from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/hljs/typescript";
import python from "react-syntax-highlighter/dist/esm/languages/hljs/python";
// ... add the ~15 languages in LanguageRegistry

Highlighter.registerLanguage("javascript", javascript);
// ...
```

For `LanguageRegistry.ts`, replace `require("highlight.js")` with the same registered light instance, or drop it entirely since `react-syntax-highlighter` already handles the rendering.

Styles: instead of `import * as HLJSSyntaxStyles` (all styles), import only the one(s) actually used:
```ts
import atomOneDark from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";
```

---

## 5. react-native-mathjax-html-to-svg (2.5 MB source — already lazy-loaded)

`MathView.tsx:5` already uses `React.lazy()` for the MathJax component and a dynamic `import("katex")` for inline rendering. This is already correctly deferred.

The library will still be in the production bundle. If math blocks are rare, consider gating the entire `MathView` on a feature flag or making the whole block type opt-in to avoid loading it for users who never use math.

No immediate action needed — the lazy loading is the right approach.

---

## Measurement baseline

All numbers above are from the **debug** APK and **unminified** source map, so they overstate production size. The recommended sequence for tracking progress:

```bash
# 1. Build a release APK after each change
./android/gradlew app:assembleRelease \
  -PreactNativeArchitectures=arm64-v8a

# 2. Measure with apkanalyzer (from Android SDK cmdline-tools)
$ANDROID_HOME/cmdline-tools/latest/bin/apkanalyzer \
  apk download-size android/app/build/outputs/apk/release/app-release.apk

# 3. For JS bundle: regenerate with source map
npx expo export:embed \
  --platform android --dev false \
  --bundle-output /tmp/bundle.js \
  --sourcemap-output /tmp/bundle.map
du -sh /tmp/bundle.js
```

---

## Recommended order of work

1. **gradle.properties**: set `reactNativeArchitectures=arm64-v8a` + enable R8. One-line changes, measure immediately.
2. **Confirm expo-dev-client is excluded from prod**: audit `app.config.js` plugin list and the prod build command. Add the `configurations.all { exclude }` safety net if needed.
3. **SyntaxHighlighter light build**: switch the two import lines and register the ~15 languages from `LanguageRegistry`. Test that all supported languages still highlight correctly.
4. **Measure and decide** on `react-native-mathjax-html-to-svg` — if the JS bundle after step 3 is already acceptable, leave it alone.
