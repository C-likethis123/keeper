import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { vitePwaPlugin } from "./web/src/build/vitePwaPlugin";

export default defineConfig({
	root: fileURLToPath(new URL("./web", import.meta.url)),
	envPrefix: ["VITE_", "EXPO_PUBLIC_"],
	define: {
		__DEV__: "false",
		global: "globalThis",
	},
	plugins: [react(), vitePwaPlugin()],
	resolve: {
		alias: {
			"@/services/sync/syncStateStorage": fileURLToPath(
				new URL("./src/services/sync/browserSyncStateStorage.ts", import.meta.url),
			),
			"@/services/notes/noteService": fileURLToPath(
				new URL("./web/src/adapters/browser/noteService.ts", import.meta.url),
			),
			"@/services/notes/attachmentStorage": fileURLToPath(
				new URL(
					"./web/src/adapters/browser/attachmentStorage.ts",
					import.meta.url,
				),
			),
			"@/components/editor/document/documentPositionStore": fileURLToPath(
				new URL(
					"./web/src/adapters/browser/documentPositionStore.ts",
					import.meta.url,
				),
			),
			"@/services/notes/Notes": fileURLToPath(
				new URL("./web/src/adapters/browser/notesRoot.ts", import.meta.url),
			),
			"@/services/notes/notesIndex": fileURLToPath(
				new URL("./web/src/adapters/browser/notesIndex.ts", import.meta.url),
			),
			"@/components/editor/lexical/wikilinks/wikiLinkUtils": fileURLToPath(
				new URL("./web/src/adapters/browser/wikiLinkUtils.ts", import.meta.url),
			),
			"@/services/notes/imageStorage": fileURLToPath(
				new URL("./web/src/adapters/browser/imageStorage.ts", import.meta.url),
			),
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			"@web": fileURLToPath(new URL("./web/src", import.meta.url)),
			"@keeper": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		name: "browser",
		root: fileURLToPath(new URL("./web", import.meta.url)),
		environment: "jsdom",
		globals: true,
		setupFiles: fileURLToPath(new URL("./web/src/test/setup.ts", import.meta.url)),
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
	},
});
