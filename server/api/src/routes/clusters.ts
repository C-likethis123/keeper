import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ClusterRepository } from "../clusters/types.js";

const clusterIdParams = z.object({
	id: z.string().min(1),
});

const clusterMemberParams = z.object({
	id: z.string().min(1),
	noteId: z.string().min(1),
});

const childClusterQuery = z.object({
	accepted: z.enum(["true", "false"]).optional(),
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

	server.get("/clusters/super/active", async () =>
		clusterRepository.listActiveSuperClusters(),
	);

	server.get("/clusters/super/accepted", async () =>
		clusterRepository.listAcceptedSuperClusters(),
	);

	server.get("/clusters/super/:id/children", async (request, reply) => {
		const parsed = clusterIdParams.safeParse(request.params);
		const query = childClusterQuery.safeParse(request.query);
		if (!parsed.success || !query.success) {
			return reply.code(400).send({ error: "invalid_cluster_id" });
		}
		const children = await clusterRepository.listChildClusters(parsed.data.id);
		return query.data.accepted === "true"
			? children.filter((cluster) => cluster.acceptedAt && !cluster.dismissedAt)
			: children;
	});

	server.get("/clusters/standalone/accepted", async () =>
		clusterRepository.listStandaloneAcceptedClusters(),
	);

	server.get("/clusters/:id/members", async (request, reply) => {
		const parsed = clusterIdParams.safeParse(request.params);
		if (!parsed.success) {
			return reply.code(400).send({ error: "invalid_cluster_id" });
		}
		return clusterRepository.listClusterMembers(parsed.data.id);
	});

	server.post("/clusters/:id/members/:noteId", async (request, reply) => {
		const parsed = clusterMemberParams.safeParse(request.params);
		if (!parsed.success) {
			return reply.code(400).send({ error: "invalid_cluster_member" });
		}
		await clusterRepository.addClusterMember(parsed.data.id, parsed.data.noteId);
		await clusterRepository.recordFeedback({
			clusterId: parsed.data.id,
			eventType: "add_note",
			eventData: { noteId: parsed.data.noteId },
		});
		return reply.code(204).send();
	});

	server.delete("/clusters/:id/members/:noteId", async (request, reply) => {
		const parsed = clusterMemberParams.safeParse(request.params);
		if (!parsed.success) {
			return reply.code(400).send({ error: "invalid_cluster_member" });
		}
		await clusterRepository.removeClusterMember(parsed.data.id, parsed.data.noteId);
		await clusterRepository.recordFeedback({
			clusterId: parsed.data.id,
			eventType: "remove_note",
			eventData: { noteId: parsed.data.noteId },
		});
		return reply.code(204).send();
	});

	server.delete("/clusters/:id", async (request, reply) => {
		const parsed = clusterIdParams.safeParse(request.params);
		if (!parsed.success) {
			return reply.code(400).send({ error: "invalid_cluster_id" });
		}
		await clusterRepository.deleteCluster(parsed.data.id);
		return reply.code(204).send();
	});

	server.post("/clusters/:id/accept", async (request, reply) => {
		const params = clusterIdParams.safeParse(request.params);
		const body = acceptSchema.safeParse(request.body ?? {});
		if (!params.success || !body.success) {
			return reply.code(400).send({ error: "invalid_cluster_accept" });
		}
		const members = await clusterRepository.listClusterMembers(params.data.id);
		const children = await clusterRepository.listChildClusters(params.data.id);
		const childMembers = await Promise.all(
			children.map((child) => clusterRepository.listClusterMembers(child.id)),
		);
		const memberIds = new Set([
			...members.map((member) => member.noteId),
			...childMembers.flat().map((member) => member.noteId),
		]);
		await clusterRepository.acceptCluster(
			params.data.id,
			body.data.acceptedNoteId,
		);
		await clusterRepository.recordFeedback({
			clusterId: params.data.id,
			eventType: "accept",
			eventData: {
				...body.data,
				clusterKind: children.length > 0 ? "super_cluster" : "cluster",
				memberIds: [...memberIds],
			},
		});
		return reply.code(204).send();
	});

	server.post("/clusters/:id/dismiss", async (request, reply) => {
		const parsed = clusterIdParams.safeParse(request.params);
		if (!parsed.success) {
			return reply.code(400).send({ error: "invalid_cluster_id" });
		}
		const members = await clusterRepository.listClusterMembers(parsed.data.id);
		const children = await clusterRepository.listChildClusters(parsed.data.id);
		const childMembers = await Promise.all(
			children.map((child) => clusterRepository.listClusterMembers(child.id)),
		);
		await clusterRepository.dismissCluster(parsed.data.id);
		await clusterRepository.recordFeedback({
			clusterId: parsed.data.id,
			eventType: "dismiss",
			eventData: {
				clusterKind: children.length > 0 ? "super_cluster" : "cluster",
				memberIds: [
					...new Set([
						...members.map((member) => member.noteId),
						...childMembers.flat().map((member) => member.noteId),
					]),
				],
			},
		});
		return reply.code(204).send();
	});

	server.post("/clusters/:id/rename", async (request, reply) => {
		const params = clusterIdParams.safeParse(request.params);
		const body = renameSchema.safeParse(request.body);
		if (!params.success || !body.success) {
			return reply.code(400).send({ error: "invalid_cluster_rename" });
		}
		const clusters = await Promise.all([
			clusterRepository.listActiveClusters(),
			clusterRepository.listAcceptedClusters(),
			clusterRepository.listActiveSuperClusters(),
			clusterRepository.listAcceptedSuperClusters(),
		]);
		const original = clusters.flat().find((cluster) => cluster.id === params.data.id);
		await clusterRepository.renameCluster(params.data.id, body.data.name);
		await clusterRepository.recordFeedback({
			clusterId: params.data.id,
			eventType: "rename",
			eventData: {
				originalName: original?.name,
				newName: body.data.name,
			},
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
