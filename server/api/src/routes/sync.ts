import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { JobQueue } from "../jobs/types.js";
import { SyncConflictError } from "../sync/errors.js";
import type { SyncRepository } from "../sync/types.js";

const isoDate = z.iso.datetime();

const baseOperationSchema = z.object({
	opId: z.string().min(1),
	seq: z.number().int().nonnegative(),
	noteId: z.string().min(1),
});

const createOperationSchema = baseOperationSchema.extend({
	type: z.literal("note.create"),
	path: z.string().min(1),
	title: z.string(),
	markdown: z.string(),
	createdAt: isoDate,
});

const updateOperationSchema = baseOperationSchema.extend({
	type: z.literal("note.update"),
	markdown: z.string(),
	updatedAt: isoDate,
});

const renameOperationSchema = baseOperationSchema.extend({
	type: z.literal("note.rename"),
	path: z.string().min(1),
	title: z.string(),
	updatedAt: isoDate,
});

const deleteOperationSchema = baseOperationSchema.extend({
	type: z.literal("note.delete"),
	deletedAt: isoDate,
});

const pushRequestSchema = z.object({
	deviceId: z.string().min(1),
	deviceName: z.string().min(1).optional(),
	ops: z
		.array(
			z.discriminatedUnion("type", [
				createOperationSchema,
				updateOperationSchema,
				renameOperationSchema,
				deleteOperationSchema,
			]),
		)
		.max(100),
});

const pullQuerySchema = z.object({
	deviceId: z.string().min(1).optional(),
	cursor: z.coerce.number().int().nonnegative().default(0),
	limit: z.coerce.number().int().positive().max(500).default(100),
});

export function registerSyncRoutes(
	server: FastifyInstance,
	syncRepository: SyncRepository,
	jobQueue?: JobQueue,
) {
	server.post("/sync/push", async (request, reply) => {
		const parsed = pushRequestSchema.safeParse(request.body);

		if (!parsed.success) {
			return reply.code(400).send({
				error: "invalid_sync_push",
				issues: parsed.error.issues,
			});
		}

		try {
			const result = await syncRepository.pushOperations(parsed.data);
			request.log.info(
				{
					accepted: result.accepted.length,
					cursor: result.cursor,
					deviceId: parsed.data.deviceId,
					duplicateCount: result.duplicates.length,
					opCount: parsed.data.ops.length,
				},
				"sync push accepted",
			);
			if (jobQueue && result.accepted.length > 0) {
				await jobQueue.enqueue("git.sync", {
					opIds: result.accepted,
					operations: parsed.data.ops.filter((operation) =>
						result.accepted.includes(operation.opId),
					),
					noteIds: [
						...new Set(
							parsed.data.ops
								.filter((operation) => result.accepted.includes(operation.opId))
								.map((operation) => operation.noteId),
						),
					],
					cursor: result.cursor,
				});
			}

			return reply.code(202).send(result);
		} catch (error) {
			if (error instanceof SyncConflictError) {
				return reply.code(409).send({
					error: "sync_conflict",
					message: error.message,
				});
			}

			throw error;
		}
	});

	server.get("/sync/pull", async (request, reply) => {
		const parsed = pullQuerySchema.safeParse(request.query);

		if (!parsed.success) {
			return reply.code(400).send({
				error: "invalid_sync_pull",
				issues: parsed.error.issues,
			});
		}

			const result = await syncRepository.pullOperations(parsed.data);
			request.log.info(
				{
					cursor: result.cursor,
					deviceId: parsed.data.deviceId,
					opCount: result.ops.length,
				},
				"sync pull returned",
			);

			return reply.code(200).send(result);
		});
}
