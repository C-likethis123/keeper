import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerHealthRoutes } from "./routes/health.js";
import { registerSyncRoutes } from "./routes/sync.js";
import type { SyncRepository } from "./sync/types.js";

export type ServerDependencies = {
	syncRepository: SyncRepository;
};

export function createServer(dependencies: ServerDependencies) {
	const server = Fastify({
		logger: true,
	});

	void server.register(cors, {
		origin: true,
	});

	registerHealthRoutes(server);
	registerSyncRoutes(server, dependencies.syncRepository);

	return server;
}
