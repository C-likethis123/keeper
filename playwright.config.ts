import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./web/e2e",
	fullyParallel: false,
	use: {
		baseURL: "http://127.0.0.1:4173",
	},
	webServer: {
		command:
			"VITE_SYNC_SERVER_URL=/api npm run build:vite && npx vite preview --config vite.config.ts --host 127.0.0.1 --port 4173",
		port: 4173,
		reuseExistingServer: !process.env.CI,
	},
});
