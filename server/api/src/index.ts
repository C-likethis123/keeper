import { createPgClusterRepository } from "./clusters/pgClusterRepository.js";
import { createGitHubSeedServiceFromEnv } from "./github/seedService.js";
import { InMemoryJobQueue } from "./jobs/inMemoryJobQueue.js";
import { RedisJobQueue } from "./jobs/redisJobQueue.js";
import { readServerSecurityConfig } from "./security/config.js";
import { createServer } from "./server.js";
import { createPgSyncRepository } from "./sync/pgSyncRepository.js";
import { createGitSyncProcessorFromEnv } from "./workers/gitWorker.js";
import { createMocClassificationProcessorFromEnv } from "./workers/mocWorker.js";

const port = Number(process.env.PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required");
}

const clusterRepository = createPgClusterRepository(databaseUrl);
const syncRepository = createPgSyncRepository(databaseUrl);
const localProcessors =
	process.env.SERVER_GITHUB_TOKEN || process.env.SERVER_GIT_REMOTE_URL
		? {
				"git.sync": createGitSyncProcessorFromEnv(syncRepository),
				"moc.classify":
					createMocClassificationProcessorFromEnv(clusterRepository),
			}
		: {};
const jobQueue = process.env.REDIS_URL
	? new RedisJobQueue(process.env.REDIS_URL)
	: new InMemoryJobQueue(localProcessors);
const seedService =
	process.env.SERVER_GIT_REMOTE_URL && process.env.SERVER_GIT_REPO_DIR
		? createGitHubSeedServiceFromEnv(syncRepository)
		: undefined;

const server = createServer({
	syncRepository,
	jobQueue,
	clusterRepository,
	githubSeed: process.env.KEEPER_SEED_TOKEN
		? {
				token: process.env.KEEPER_SEED_TOKEN,
				service: seedService
					? {
							async seed(input) {
								const result = await seedService.seed(input);
								await jobQueue.enqueue("moc.classify", {
									source: "github.seed",
									sha: result.sha,
								});
								return result;
							},
						}
					: undefined,
			}
		: undefined,
	security: readServerSecurityConfig(),
});

await server.listen({ host: "0.0.0.0", port });
