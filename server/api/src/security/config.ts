const KIB = 1024;
const MIB = 1024 * KIB;

export type CloudflareAccessConfig = {
	audience: string;
	teamDomain: string;
};

export type ServerSecurityConfig = {
	bodyLimitBytes: number;
	corsAllowedOrigins: string[];
	rateLimitMax: number;
	rateLimitWindowMs: number;
	syncBodyLimitBytes: number;
};

export const DEFAULT_SERVER_SECURITY_CONFIG: ServerSecurityConfig = {
	bodyLimitBytes: 64 * KIB,
	corsAllowedOrigins: [
		"https://keeper.pages.dev",
		"tauri://localhost",
		"http://tauri.localhost",
		"http://localhost:8082",
	],
	rateLimitMax: 120,
	rateLimitWindowMs: 60_000,
	syncBodyLimitBytes: 16 * MIB,
};

function readPositiveInteger(
	value: string | undefined,
	fallback: number,
	name: string,
): number {
	if (!value) return fallback;
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}
	return parsed;
}

function parseAllowedOrigins(value: string | undefined): string[] {
	if (value === undefined) {
		return DEFAULT_SERVER_SECURITY_CONFIG.corsAllowedOrigins;
	}

	const origins = value
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);
	const originPattern =
		/^[a-z][a-z0-9+.-]*:\/\/(?:\[[^\]]+\]|[^/?#:\s]+)(?::\d+)?$/i;

	for (const origin of origins) {
		if (origin === "*" || origin === "null" || !originPattern.test(origin)) {
			throw new Error(
				"KEEPER_CORS_ALLOWED_ORIGINS must contain exact origins without paths",
			);
		}
	}

	return [...new Set(origins)];
}

export function readServerSecurityConfig(
	env: NodeJS.ProcessEnv = process.env,
): ServerSecurityConfig {
	return {
		...DEFAULT_SERVER_SECURITY_CONFIG,
		corsAllowedOrigins: parseAllowedOrigins(env.KEEPER_CORS_ALLOWED_ORIGINS),
		rateLimitMax: readPositiveInteger(
			env.KEEPER_RATE_LIMIT_MAX,
			DEFAULT_SERVER_SECURITY_CONFIG.rateLimitMax,
			"KEEPER_RATE_LIMIT_MAX",
		),
		rateLimitWindowMs: readPositiveInteger(
			env.KEEPER_RATE_LIMIT_WINDOW_MS,
			DEFAULT_SERVER_SECURITY_CONFIG.rateLimitWindowMs,
			"KEEPER_RATE_LIMIT_WINDOW_MS",
		),
		syncBodyLimitBytes: readPositiveInteger(
			env.KEEPER_SYNC_BODY_LIMIT_BYTES,
			DEFAULT_SERVER_SECURITY_CONFIG.syncBodyLimitBytes,
			"KEEPER_SYNC_BODY_LIMIT_BYTES",
		),
	};
}

export function readCloudflareAccessConfig(
	env: NodeJS.ProcessEnv = process.env,
): CloudflareAccessConfig {
	const teamDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim();
	const audience = env.CLOUDFLARE_ACCESS_AUD?.trim();
	if (!teamDomain || !audience) {
		throw new Error(
			"CLOUDFLARE_ACCESS_TEAM_DOMAIN and CLOUDFLARE_ACCESS_AUD are required",
		);
	}

	let parsed: URL;
	try {
		parsed = new URL(teamDomain);
	} catch {
		throw new Error("CLOUDFLARE_ACCESS_TEAM_DOMAIN must be an HTTPS origin");
	}
	if (
		parsed.protocol !== "https:" ||
		parsed.origin !== teamDomain.replace(/\/$/, "") ||
		parsed.pathname !== "/"
	) {
		throw new Error("CLOUDFLARE_ACCESS_TEAM_DOMAIN must be an HTTPS origin");
	}

	return { audience, teamDomain: parsed.origin };
}

export function readOptionalCloudflareAccessConfig(
	env: NodeJS.ProcessEnv = process.env,
): CloudflareAccessConfig | undefined {
	const teamDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim();
	const audience = env.CLOUDFLARE_ACCESS_AUD?.trim();
	if (!teamDomain && !audience) return undefined;
	return readCloudflareAccessConfig(env);
}
