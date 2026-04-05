// Platform-specific git engine selection
// .native.ts -> RustGitEngine with native bridge (iOS/Android)
// .web.ts -> RustGitEngine with Tauri invoke (web/desktop)
export { getGitEngine } from "./gitEngine.native";
