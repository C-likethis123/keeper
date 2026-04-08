// This component has been split into platform-specific implementations:
// - DocumentPanel.web.tsx (Tauri desktop - browser-based viewers)
// - DocumentPanel.native.tsx (iOS/Android - WebView-based viewers)
//
// Re-export from .native.ts as a fallback for TypeScript/bundler resolution
export * from "./DocumentPanel.native";
