import assert from "node:assert/strict";
import { test } from "node:test";
import { readServerSecurityConfig } from "./config.js";

test("security config parses exact CORS origins and numeric limits", () => {
	const config = readServerSecurityConfig({
		KEEPER_CORS_ALLOWED_ORIGINS:
			"https://keeper.example,tauri://localhost,https://keeper.example",
		KEEPER_RATE_LIMIT_MAX: "60",
		KEEPER_RATE_LIMIT_WINDOW_MS: "30000",
		KEEPER_SYNC_BODY_LIMIT_BYTES: "2048",
	} as NodeJS.ProcessEnv);

	assert.deepEqual(config.corsAllowedOrigins, [
		"https://keeper.example",
		"tauri://localhost",
	]);
	assert.equal(config.rateLimitMax, 60);
	assert.equal(config.rateLimitWindowMs, 30_000);
	assert.equal(config.syncBodyLimitBytes, 2_048);
});

test("security config rejects wildcard and path origins", () => {
	assert.throws(() =>
		readServerSecurityConfig({
			KEEPER_CORS_ALLOWED_ORIGINS: "*",
		} as NodeJS.ProcessEnv),
	);
	assert.throws(() =>
		readServerSecurityConfig({
			KEEPER_CORS_ALLOWED_ORIGINS: "https://keeper.example/app",
		} as NodeJS.ProcessEnv),
	);
});
