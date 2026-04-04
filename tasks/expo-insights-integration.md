# Plan: Integrate expo-insights (EAS Insights)

## Overview

Integrate `expo-insights` to enable EAS Insights metrics for Keeper. This provides automatic cold start tracking and app performance visibility via the EAS Dashboard.

**Scope**: Minimal — the library works automatically once installed. No custom instrumentation code required.

**Prerequisites already met**:
- EAS project is already configured (`projectId: "0e09ac97-269f-48f9-ae60-4f4bda4ae973"` in `app.config.js`)
- `expo-updates` is already installed (`~29.0.16`)

---

## Steps

### 1. Install the package
```bash
npx expo install expo-insights
```
This uses Expo's version-matched installer to ensure compatibility with SDK 54.

### 2. Verify app.config.js has the EAS project ID
Already present at line 65-66 of `app.config.js`. No changes needed.

### 3. Build and deploy
The library must be included in a native build (it cannot work in Expo Go). Build options:

| Option | Command |
|--------|---------|
| Local Android | `npm run android` (prod) or `npm run android:dev` (dev) |
| Local iOS | `npm run ios` |
| EAS Build (cloud) | `eas build --platform android` / `eas build --platform ios` |

### 4. View metrics
After the build is installed and launched by users:
1. Go to [EAS Dashboard](https://expo.dev/accounts/chowjiaying/projects/0e09ac97-269f-48f9-ae60-4f4bda4ae973)
2. Select the **Insights** tab

---

## What Gets Tracked

- **Cold starts** — currently the only tracked event
- Future EAS updates will add more event types

No code changes are required in `_layout.tsx` or any other source file. The library auto-initializes and reports events on its own.

---

## Notes

- `expo-insights` is free during the preview period
- Requires a native build (development build or production), not Expo Go
- Works in tandem with `expo-updates` (already installed)
- No privacy concerns — only aggregate cold start metrics are sent to EAS, no user data
