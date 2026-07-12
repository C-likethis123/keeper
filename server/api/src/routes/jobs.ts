import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { JobKind, JobQueue } from "../jobs/types.js";

const jobKindSchema = z.enum(["git.sync", "moc.classify"]);

const listJobsQuerySchema = z.object({
	kind: jobKindSchema.optional(),
});

const enqueueJobSchema = z.object({
	kind: jobKindSchema,
	input: z.record(z.string(), z.unknown()).default({}),
});

export function registerJobRoutes(server: FastifyInstance, jobQueue: JobQueue) {
	server.get("/jobs", async (request, reply) => {
		const parsed = listJobsQuerySchema.safeParse(request.query);
		if (!parsed.success) {
			return reply.code(400).send({
				error: "invalid_jobs_query",
				issues: parsed.error.issues,
			});
		}

		return reply.send(await jobQueue.listJobs(parsed.data.kind));
	});

	server.get("/jobs/:id", async (request, reply) => {
		const { id } = request.params as { id: string };
		const job = await jobQueue.getJob(id);
		if (!job) {
			return reply.code(404).send({ error: "job_not_found" });
		}
		return reply.send(job);
	});

	server.post("/jobs", async (request, reply) => {
		const parsed = enqueueJobSchema.safeParse(request.body);
		if (!parsed.success) {
			return reply.code(400).send({
				error: "invalid_job",
				issues: parsed.error.issues,
			});
		}

		const job = await jobQueue.enqueue(
			parsed.data.kind as JobKind,
			parsed.data.input,
		);
		return reply.code(202).send(job);
	});
}
