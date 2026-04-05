// Platform-specific storage engine selection
// .native.ts -> MobileStorageEngine (iOS/Android)
// .web.ts -> TauriStorageEngine (web/desktop)
// 
// Jest tests will be mocked via jest.doMock in test files
export { storageEngine } from "./storageEngine.native";
export { getStorageEngine } from "./storageEngine.native";
