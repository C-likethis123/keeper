import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
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
	const server = Fastify({
		bodyLimit: security.bodyLimitBytes,
		logger: true,
		trustProxy: 1,
	});

	server.addHook("onRequest", async (request, reply) => {
		const origin = request.headers.origin;
		if (origin && !allowedOrigins.has(origin)) {
			return reply.code(403).send({ error: "origin_not_allowed" });
		}
	});

	void server.register(cors, {
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: false,
		maxAge: 600,
		methods: ["GET", "POST", "DELETE", "OPTIONS"],
		origin: security.corsAllowedOrigins,
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
		registerSyncRoutes(
			limitedServer,
			dependencies.syncRepository,
			dependencies.jobQueue,
			security.syncBodyLimitBytes,
		);
		if (dependencies.githubSeed) {
			registerGitHubRoutes(limitedServer, {
				syncRepository: dependencies.syncRepository,
				seedToken: dependencies.githubSeed.token,
				seedService: dependencies.githubSeed.service,
			});
		}
		if (dependencies.jobQueue) {
			registerJobRoutes(limitedServer, dependencies.jobQueue);
		}
		if (dependencies.clusterRepository) {
			registerClusterRoutes(limitedServer, dependencies.clusterRepository);
		}
	});

	return server;
}
