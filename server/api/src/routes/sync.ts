import type { FastifyInstance } from "fastify";
import { z } from "zod";
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
	title: z.string().min(1),
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
	title: z.string().min(1),
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

export function registerSyncRoutes(
	server: FastifyInstance,
	syncRepository: SyncRepository,
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
}
