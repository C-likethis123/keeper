import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	root: "web",
	plugins: [react()],
	resolve: {
		alias: {
			"@/services/notes/noteService": fileURLToPath(new URL("./web/src/adapters/browser/noteService.ts", import.meta.url)),
			"@/services/notes/attachmentStorage": fileURLToPath(new URL("./web/src/adapters/browser/attachmentStorage.ts", import.meta.url)),
			"@/components/editor/document/documentPositionStore": fileURLToPath(new URL("./web/src/adapters/browser/documentPositionStore.ts", import.meta.url)),
			"@/services/notes/Notes": fileURLToPath(new URL("./web/src/adapters/browser/notesRoot.ts", import.meta.url)),
			"@/services/notes/notesIndex": fileURLToPath(new URL("./web/src/adapters/browser/notesIndex.ts", import.meta.url)),
			"@/components/editor/lexical/wikilinks/wikiLinkUtils": fileURLToPath(new URL("./web/src/adapters/browser/wikiLinkUtils.ts", import.meta.url)),
			"@/services/notes/imageStorage": fileURLToPath(new URL("./web/src/adapters/browser/imageStorage.ts", import.meta.url)),
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			"@web": fileURLToPath(new URL("./web/src", import.meta.url)),
			"react-native": "react-native-web",
			"@expo/vector-icons": fileURLToPath(new URL("./web/src/adapters/browser/expoVectorIcons.tsx", import.meta.url)),
			"react-native-mathjax-html-to-svg": fileURLToPath(new URL("./web/src/adapters/browser/nativeMathJax.tsx", import.meta.url)),
			"expo-image": fileURLToPath(new URL("./web/src/adapters/browser/expoImage.tsx", import.meta.url)),
			"@keeper": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: "./src/test/setup.ts",
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		server: {
			deps: {
				inline: ["react-native", "@react-navigation/native", "@expo/vector-icons", "expo-image", "react-native-mathjax-html-to-svg"],
			},
		},
	},
});
