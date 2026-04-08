// This module has been split into platform-specific implementations:
// - repoBootstrapper.web.ts (Tauri desktop)
// - repoBootstrapper.native.ts (iOS/Android)
//
// Re-export from .native as a fallback for TypeScript/bundler resolution
export { DefaultRepoBootstrapper } from "./repoBootstrapper.native";
