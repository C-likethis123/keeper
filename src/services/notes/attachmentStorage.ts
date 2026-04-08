// This module has been split into platform-specific implementations:
// - attachmentStorage.web.ts (Tauri desktop)
// - attachmentStorage.native.ts (iOS/Android)
//
// Re-export from .web.ts as a fallback for TypeScript/bundler resolution
export * from "./attachmentStorage.web";
