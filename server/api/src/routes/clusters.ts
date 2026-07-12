import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ClusterRepository } from "../clusters/types.js";

const clusterIdParams = z.object({
	id: z.string().min(1),
});

const acceptSchema = z.object({
	acceptedNoteId: z.string().min(1).optional(),
});

const renameSchema = z.object({
	name: z.string().min(1),
});

const feedbackSchema = z.object({
	eventType: z.string().min(1),
	eventData: z.record(z.string(), z.unknown()).default({}),
});

export function registerClusterRoutes(
	server: FastifyInstance,
	clusterRepository: ClusterRepository,
) {
	server.get("/clusters/active", async () =>
		clusterRepository.listActiveClusters(),
	);

	server.get("/clusters/accepted", async () =>
		clusterRepository.listAcceptedClusters(),
	);

	server.get("/clusters/:id/members", async (request, reply) => {
		const parsed = clusterIdParams.safeParse(request.params);
		if (!parsed.success) {
			return reply.code(400).send({ error: "invalid_cluster_id" });
		}
		return clusterRepository.listClusterMembers(parsed.data.id);
	});

	server.post("/clusters/:id/accept", async (request, reply) => {
		const params = clusterIdParams.safeParse(request.params);
		const body = acceptSchema.safeParse(request.body ?? {});
		if (!params.success || !body.success) {
			return reply.code(400).send({ error: "invalid_cluster_accept" });
		}
		await clusterRepository.acceptCluster(
			params.data.id,
			body.data.acceptedNoteId,
		);
		await clusterRepository.recordFeedback({
			clusterId: params.data.id,
			eventType: "accept",
			eventData: body.data,
		});
		return reply.code(204).send();
	});

	server.post("/clusters/:id/dismiss", async (request, reply) => {
		const parsed = clusterIdParams.safeParse(request.params);
		if (!parsed.success) {
			return reply.code(400).send({ error: "invalid_cluster_id" });
		}
		await clusterRepository.dismissCluster(parsed.data.id);
		await clusterRepository.recordFeedback({
			clusterId: parsed.data.id,
			eventType: "dismiss",
			eventData: {},
		});
		return reply.code(204).send();
	});

	server.post("/clusters/:id/rename", async (request, reply) => {
		const params = clusterIdParams.safeParse(request.params);
		const body = renameSchema.safeParse(request.body);
		if (!params.success || !body.success) {
			return reply.code(400).send({ error: "invalid_cluster_rename" });
		}
		await clusterRepository.renameCluster(params.data.id, body.data.name);
		await clusterRepository.recordFeedback({
			clusterId: params.data.id,
			eventType: "rename",
			eventData: body.data,
		});
		return reply.code(204).send();
	});

	server.post("/clusters/:id/feedback", async (request, reply) => {
		const params = clusterIdParams.safeParse(request.params);
		const body = feedbackSchema.safeParse(request.body);
		if (!params.success || !body.success) {
			return reply.code(400).send({ error: "invalid_cluster_feedback" });
		}
		const feedback = await clusterRepository.recordFeedback({
			clusterId: params.data.id,
			eventType: body.data.eventType,
			eventData: body.data.eventData,
		});
		return reply.code(201).send(feedback);
	});

	server.get("/clusters/feedback", async () => clusterRepository.listFeedback());
}
