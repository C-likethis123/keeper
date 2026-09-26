import assert from "node:assert/strict";
import { test } from "node:test";
import {
	readCloudflareAccessConfig,
	readOptionalCloudflareAccessConfig,
	readServerSecurityConfig,
} from "./config.js";

test("security config parses exact CORS origins and numeric limits", () => {
	const config = readServerSecurityConfig({
		KEEPER_CORS_ALLOWED_ORIGINS:
			"https://keeper.example,https://preview.keeper.example,https://keeper.example",
		KEEPER_RATE_LIMIT_MAX: "60",
		KEEPER_RATE_LIMIT_WINDOW_MS: "30000",
		KEEPER_SYNC_BODY_LIMIT_BYTES: "2048",
	} as NodeJS.ProcessEnv);

	assert.deepEqual(config.corsAllowedOrigins, [
		"https://keeper.example",
		"https://preview.keeper.example",
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

test("security config allows production PWA by default", () => {
	assert.deepEqual(
		readServerSecurityConfig({} as NodeJS.ProcessEnv).corsAllowedOrigins,
		["https://keeper.pages.dev"],
	);
});

test("Cloudflare Access config requires an HTTPS team origin and audience", () => {
	assert.deepEqual(
		readCloudflareAccessConfig({
			CLOUDFLARE_ACCESS_AUD: "keeper-audience",
			CLOUDFLARE_ACCESS_TEAM_DOMAIN:
				"https://keeper.cloudflareaccess.com/",
		} as NodeJS.ProcessEnv),
		{
			audience: "keeper-audience",
			teamDomain: "https://keeper.cloudflareaccess.com",
		},
	);
	assert.throws(() => readCloudflareAccessConfig({} as NodeJS.ProcessEnv));
	assert.throws(() =>
		readCloudflareAccessConfig({
			CLOUDFLARE_ACCESS_AUD: "keeper-audience",
			CLOUDFLARE_ACCESS_TEAM_DOMAIN: "http://keeper.cloudflareaccess.com",
		} as NodeJS.ProcessEnv),
	);
});

test("optional Cloudflare Access config is absent when both values are absent", () => {
	assert.equal(
		readOptionalCloudflareAccessConfig({} as NodeJS.ProcessEnv),
		undefined,
	);
	assert.throws(() =>
		readOptionalCloudflareAccessConfig({
			CLOUDFLARE_ACCESS_AUD: "keeper-audience",
		} as NodeJS.ProcessEnv),
	);
});
