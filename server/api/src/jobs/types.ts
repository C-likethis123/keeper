export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type JobKind = "git.sync" | "moc.classify";

export type ServerJob = {
	id: string;
	kind: JobKind;
	status: JobStatus;
	createdAt: string;
	updatedAt: string;
	input: Record<string, unknown>;
	error?: string;
};

export type JobProcessor = (job: ServerJob) => Promise<void>;

export type JobQueue = {
	enqueue(kind: JobKind, input: Record<string, unknown>): Promise<ServerJob>;
	getJob(id: string): Promise<ServerJob | null>;
	listJobs(kind?: JobKind): Promise<ServerJob[]>;
};
