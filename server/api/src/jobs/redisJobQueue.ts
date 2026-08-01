import { type Job, Queue, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import type { JobKind, JobQueue, JobStatus, ServerJob } from "./types.js";

export const SERVER_JOB_QUEUE = "keeper-server-jobs";

type JobData = {
	kind: JobKind;
	input: Record<string, unknown>;
};

function mapStatus(status: string): JobStatus {
	if (status === "active") return "running";
	if (status === "completed") return "succeeded";
	if (status === "failed") return "failed";
	return "queued";
}

async function mapJob(job: Job<JobData>): Promise<ServerJob> {
	const status = await job.getState();
	return {
		id: job.id ?? "",
		kind: job.data.kind,
		status: mapStatus(status),
		createdAt: new Date(job.timestamp).toISOString(),
		updatedAt: new Date(job.finishedOn ?? job.processedOn ?? job.timestamp).toISOString(),
		input: job.data.input,
		error: job.failedReason || undefined,
	};
}

export function createRedisConnection(redisUrl: string): Redis {
	return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export class RedisJobQueue implements JobQueue {
	readonly queue: Queue<JobData>;

	constructor(redisUrl: string) {
		this.queue = new Queue<JobData>(SERVER_JOB_QUEUE, {
			connection: createRedisConnection(redisUrl),
		});
	}

	async enqueue(
		kind: JobKind,
		input: Record<string, unknown>,
	): Promise<ServerJob> {
		if (kind === "moc.classify") {
			const existing = (
				await this.queue.getJobs(["wait", "active", "delayed"], 0, 100)
			).find((job) => job.data.kind === kind);
			if (existing) return mapJob(existing);
		}

		const options: JobsOptions = {
			removeOnComplete: { age: 7 * 24 * 60 * 60, count: 200 },
			removeOnFail: { age: 30 * 24 * 60 * 60, count: 500 },
		};
		if (kind === "moc.classify") {
			options.delay = Number(process.env.MOC_CLASSIFY_DELAY_MS ?? 15_000);
		}
		const job = await this.queue.add(kind, { kind, input }, options);
		return mapJob(job);
	}

	async getJob(id: string): Promise<ServerJob | null> {
		const job = await this.queue.getJob(id);
		return job ? mapJob(job) : null;
	}

	async listJobs(kind?: JobKind): Promise<ServerJob[]> {
		const jobs = await this.queue.getJobs(
			["wait", "active", "delayed", "completed", "failed"],
			0,
			199,
			true,
		);
		const filtered = kind ? jobs.filter((job) => job.data.kind === kind) : jobs;
		return Promise.all(filtered.map(mapJob));
	}

	async close(): Promise<void> {
		await this.queue.close();
	}
}
