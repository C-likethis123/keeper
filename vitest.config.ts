import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		exclude: [
			...configDefaults.exclude,
			"**/*.jest.test.ts",
			"**/*.jest.test.tsx",
		],
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
});
