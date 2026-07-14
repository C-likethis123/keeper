import cors from "@fastify/cors";
import Fastify from "fastify";
import type { ClusterRepository } from "./clusters/types.js";
import type { GitHubSeedService } from "./github/seedService.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerClusterRoutes } from "./routes/clusters.js";
import { registerGitHubRoutes } from "./routes/github.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerSyncRoutes } from "./routes/sync.js";
import type { JobQueue } from "./jobs/types.js";
import type { SyncRepository } from "./sync/types.js";

export type ServerDependencies = {
	syncRepository: SyncRepository;
	jobQueue?: JobQueue;
	clusterRepository?: ClusterRepository;
	githubSeed?: {
		token: string;
		service: GitHubSeedService;
	};
};

export function createServer(dependencies: ServerDependencies) {
	const server = Fastify({
		logger: true,
	});

	void server.register(cors, {
		origin: true,
	});

	registerHealthRoutes(server);
	registerSyncRoutes(server, dependencies.syncRepository, dependencies.jobQueue);
	if (dependencies.githubSeed) {
		registerGitHubRoutes(server, {
			syncRepository: dependencies.syncRepository,
			seedToken: dependencies.githubSeed.token,
			seedService: dependencies.githubSeed.service,
		});
	}
	if (dependencies.jobQueue) {
		registerJobRoutes(server, dependencies.jobQueue);
	}
	if (dependencies.clusterRepository) {
		registerClusterRoutes(server, dependencies.clusterRepository);
	}

	return server;
}
