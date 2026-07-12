import { nanoid } from "nanoid";
import type { JobKind, JobProcessor, JobQueue, ServerJob } from "./types.js";

export class InMemoryJobQueue implements JobQueue {
	private readonly jobs = new Map<string, ServerJob>();
	private readonly processors: Partial<Record<JobKind, JobProcessor>>;

	constructor(processors: Partial<Record<JobKind, JobProcessor>> = {}) {
		this.processors = processors;
	}

	async enqueue(
		kind: JobKind,
		input: Record<string, unknown>,
	): Promise<ServerJob> {
		const now = new Date().toISOString();
		const job: ServerJob = {
			id: nanoid(),
			kind,
			status: "queued",
			createdAt: now,
			updatedAt: now,
			input,
		};
		this.jobs.set(job.id, job);
		void this.processJob(job);
		return job;
	}

	async getJob(id: string): Promise<ServerJob | null> {
		return this.jobs.get(id) ?? null;
	}

	async listJobs(kind?: JobKind): Promise<ServerJob[]> {
		const jobs = [...this.jobs.values()].sort((a, b) =>
			b.createdAt.localeCompare(a.createdAt),
		);
		return kind ? jobs.filter((job) => job.kind === kind) : jobs;
	}

	private async processJob(job: ServerJob): Promise<void> {
		const processor = this.processors[job.kind];
		if (!processor) return;

		this.updateJob(job.id, { status: "running" });
		console.info(`[JobQueue] ${job.kind} ${job.id} running`);
		try {
			await processor({ ...job, status: "running" });
			this.updateJob(job.id, { status: "succeeded" });
			console.info(`[JobQueue] ${job.kind} ${job.id} succeeded`);
			if (job.kind === "git.sync" && this.processors["moc.classify"]) {
				await this.enqueue("moc.classify", {
					noteIds: job.input.noteIds ?? [],
					cursor: job.input.cursor ?? null,
					gitJobId: job.id,
				});
			}
		} catch (error) {
			this.updateJob(job.id, {
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
			});
			console.error(`[JobQueue] ${job.kind} ${job.id} failed`, error);
		}
	}

	private updateJob(
		id: string,
		patch: Pick<ServerJob, "status"> & Partial<Pick<ServerJob, "error">>,
	): void {
		const existing = this.jobs.get(id);
		if (!existing) return;
		this.jobs.set(id, {
			...existing,
			...patch,
			updatedAt: new Date().toISOString(),
		});
	}
}
