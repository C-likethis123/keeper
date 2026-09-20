import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	root: "web",
	plugins: [react()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./web/src", import.meta.url)),
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: "./src/test/setup.ts",
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
	},
});
