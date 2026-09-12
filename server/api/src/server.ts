import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import type { CloudflareAccessVerifier } from "./auth/cloudflareAccess.js";
import type { ClusterRepository } from "./clusters/types.js";
import type { GitHubSeedService } from "./github/seedService.js";
import type { JobQueue } from "./jobs/types.js";
import { registerClusterRoutes } from "./routes/clusters.js";
import { registerGitHubRoutes } from "./routes/github.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerSyncRoutes } from "./routes/sync.js";
import {
	DEFAULT_SERVER_SECURITY_CONFIG,
	type ServerSecurityConfig,
} from "./security/config.js";
import type { SyncRepository } from "./sync/types.js";

export type ServerDependencies = {
	cloudflareAccess?: CloudflareAccessVerifier;
	privateProxyToken?: string;
	syncRepository: SyncRepository;
	jobQueue?: JobQueue;
	clusterRepository?: ClusterRepository;
	githubSeed?: {
		token: string;
		service?: GitHubSeedService;
	};
	security?: Partial<ServerSecurityConfig>;
};

export function createServer(dependencies: ServerDependencies) {
	const security = {
		...DEFAULT_SERVER_SECURITY_CONFIG,
		...dependencies.security,
	};
	const allowedOrigins = new Set(security.corsAllowedOrigins);
	const allowsTauriLocalhost =
		allowedOrigins.has("tauri://localhost") ||
		allowedOrigins.has("http://localhost:8082");
	const isAllowedOrigin = (origin: string | undefined): boolean =>
		!origin ||
		allowedOrigins.has(origin) ||
		(allowsTauriLocalhost && /^http:\/\/localhost:\d+$/.test(origin));
	const hasValidPrivateProxyToken = (value: string | string[] | undefined) => {
		if (!dependencies.privateProxyToken || !value || Array.isArray(value)) {
			return false;
		}
		const expected = Buffer.from(dependencies.privateProxyToken);
		const received = Buffer.from(value);
		return (
			expected.length === received.length && timingSafeEqual(expected, received)
		);
	};
	const server = Fastify({
		bodyLimit: security.bodyLimitBytes,
		logger: true,
		trustProxy: 1,
	});

	server.addHook("onRequest", async (request, reply) => {
		const origin = request.headers.origin;
		if (!isAllowedOrigin(origin)) {
			return reply.code(403).send({ error: "origin_not_allowed" });
		}
	});

	void server.register(cors, {
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
		maxAge: 600,
		methods: ["GET", "POST", "DELETE", "OPTIONS"],
		origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
		strictPreflight: true,
	});
	void server.register(async (limitedServer) => {
		await limitedServer.register(rateLimit, {
			cache: 10_000,
			global: true,
			ipv6Subnet: 64,
			max: security.rateLimitMax,
			skipOnError: false,
			timeWindow: security.rateLimitWindowMs,
		});

		registerHealthRoutes(limitedServer);
		if (dependencies.githubSeed) {
			registerGitHubRoutes(limitedServer, {
				syncRepository: dependencies.syncRepository,
				seedToken: dependencies.githubSeed.token,
				seedService: dependencies.githubSeed.service,
			});
		}
		void limitedServer.register(async (protectedServer) => {
			const cloudflareAccess = dependencies.cloudflareAccess;
			if (cloudflareAccess || dependencies.privateProxyToken) {
				protectedServer.addHook("onRequest", async (request, reply) => {
					if (request.method === "OPTIONS") return;
					if (
						hasValidPrivateProxyToken(
							request.headers["x-keeper-private-proxy-token"],
						)
					) {
						return;
					}
					if (!cloudflareAccess) {
						return reply.code(403).send({ error: "cloudflare_access_required" });
					}
					const token = request.headers["cf-access-jwt-assertion"];
					if (!token || Array.isArray(token)) {
						return reply.code(403).send({ error: "cloudflare_access_required" });
					}
					try {
						await cloudflareAccess(token);
					} catch {
						return reply.code(403).send({ error: "cloudflare_access_required" });
					}
				});
			}

			registerSyncRoutes(
				protectedServer,
				dependencies.syncRepository,
				dependencies.jobQueue,
				security.syncBodyLimitBytes,
			);
			if (dependencies.jobQueue) {
				registerJobRoutes(protectedServer, dependencies.jobQueue);
			}
			if (dependencies.clusterRepository) {
				registerClusterRoutes(protectedServer, dependencies.clusterRepository);
			}
		});
	});

	return server;
}
