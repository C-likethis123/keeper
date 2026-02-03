// Base file for TypeScript - Metro will use Notes.web.ts or Notes.android.ts at runtime
import * as FileSystem from "expo-file-system";

export const NOTES_ROOT = `${FileSystem.cacheDirectory ?? ''}notes/`;

