import { Worker } from "bullmq";
import { createPgClusterRepository } from "./clusters/pgClusterRepository.js";
import {
	createRedisConnection,
	RedisJobQueue,
	SERVER_JOB_QUEUE,
} from "./jobs/redisJobQueue.js";
import type { JobKind, JobProcessor } from "./jobs/types.js";
import { createGitSyncProcessorFromEnv } from "./workers/gitWorker.js";
import { createMocClassificationProcessorFromEnv } from "./workers/mocWorker.js";

const redisUrl = process.env.REDIS_URL;
const databaseUrl = process.env.DATABASE_URL;
if (!redisUrl) throw new Error("REDIS_URL is required");
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const clusterRepository = createPgClusterRepository(databaseUrl);
const queue = new RedisJobQueue(redisUrl);
const processors: Record<JobKind, JobProcessor> = {
	"git.sync": createGitSyncProcessorFromEnv(),
	"moc.classify": createMocClassificationProcessorFromEnv(clusterRepository),
};

const worker = new Worker(
	SERVER_JOB_QUEUE,
	async (job) => {
		const processor = processors[job.data.kind as JobKind];
		await processor({
			id: job.id ?? "",
			kind: job.data.kind,
			status: "running",
			createdAt: new Date(job.timestamp).toISOString(),
			updatedAt: new Date().toISOString(),
			input: job.data.input,
		});
		if (job.data.kind === "git.sync") {
			await queue.enqueue("moc.classify", {
				noteIds: job.data.input.noteIds ?? [],
				cursor: job.data.input.cursor ?? null,
				gitJobId: job.id,
			});
		}
	},
	{
		connection: createRedisConnection(redisUrl),
		concurrency: 1,
	},
);

worker.on("completed", (job) => {
	console.info(`[Worker] ${job.data.kind} ${job.id} succeeded`);
});
worker.on("failed", (job, error) => {
	console.error(`[Worker] ${job?.data.kind ?? "unknown"} ${job?.id ?? "unknown"} failed`, error);
});

async function close(): Promise<void> {
	await worker.close();
	await queue.close();
}

process.once("SIGTERM", () => void close());
process.once("SIGINT", () => void close());
