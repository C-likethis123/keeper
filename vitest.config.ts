import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			"./vite.config.ts",
			{
				plugins: [react()],
				define: { __DEV__: "true", global: "globalThis" },
				resolve: {
					alias: {
						"@": fileURLToPath(new URL("./src", import.meta.url)),
					},
					extensions: [".ts", ".tsx", ".js", ".json"],
				},
				test: {
					name: "source",
					environment: "jsdom",
					globals: true,
					clearMocks: true,
					setupFiles: ["./src/test/setup.ts"],
					include: ["src/**/*.test.{ts,tsx}"],
				},
			},
		],
	},
});
