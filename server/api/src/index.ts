import { createServer } from "./server.js";
import { createPgClusterRepository } from "./clusters/pgClusterRepository.js";
import { InMemoryJobQueue } from "./jobs/inMemoryJobQueue.js";
import { createPgSyncRepository } from "./sync/pgSyncRepository.js";
import { createGitSyncProcessorFromEnv } from "./workers/gitWorker.js";
import { createMocClassificationProcessorFromEnv } from "./workers/mocWorker.js";

const port = Number(process.env.PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required");
}

const clusterRepository = createPgClusterRepository(databaseUrl);
const processors =
	process.env.SERVER_GIT_REMOTE_URL && process.env.SERVER_GIT_REPO_DIR
		? {
				"git.sync": createGitSyncProcessorFromEnv(),
				"moc.classify": createMocClassificationProcessorFromEnv(clusterRepository),
			}
		: {};

const server = createServer({
	syncRepository: createPgSyncRepository(databaseUrl),
	jobQueue: new InMemoryJobQueue(processors),
	clusterRepository,
});

await server.listen({ host: "0.0.0.0", port });
