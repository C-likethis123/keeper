import type {
	ClusterFeedbackRow,
	ClusterMemberRow,
	ClusterRepository,
	ClusterRow,
	ClustersJson,
} from "./types.js";

export class InMemoryClusterRepository implements ClusterRepository {
	private readonly clusters = new Map<string, ClusterRow>();
	private readonly members = new Map<string, ClusterMemberRow[]>();
	private readonly feedback: ClusterFeedbackRow[] = [];
	private nextFeedbackId = 1;

	async importClusters(input: ClustersJson): Promise<number> {
		const now = new Date().toISOString();
		for (const cluster of [...this.clusters.values()]) {
			if (!cluster.acceptedAt && !cluster.dismissedAt) {
				this.clusters.delete(cluster.id);
				this.members.delete(cluster.id);
			}
		}
		for (const superCluster of input.super_clusters ?? []) {
			const existing = this.clusters.get(superCluster.id);
			this.clusters.set(superCluster.id, {
				id: superCluster.id,
				name: existing?.acceptedAt ? existing.name : superCluster.name,
				confidence: superCluster.confidence,
				createdAt: existing?.createdAt ?? now,
				acceptedAt: existing?.acceptedAt ?? null,
				dismissedAt: existing?.dismissedAt ?? null,
				acceptedNoteId: existing?.acceptedNoteId ?? null,
				parentId: null,
				kind: "super_cluster",
			});
		}
		for (const cluster of input.clusters) {
			const existing = this.clusters.get(cluster.id);
			this.clusters.set(cluster.id, {
				id: cluster.id,
				name: existing?.acceptedAt ? existing.name : cluster.name,
				confidence: cluster.confidence,
				createdAt: existing?.createdAt ?? now,
				acceptedAt: existing?.acceptedAt ?? null,
				dismissedAt: existing?.dismissedAt ?? null,
				acceptedNoteId: existing?.acceptedNoteId ?? null,
				parentId: cluster.parent_id ?? null,
				kind: "cluster",
			});
			this.members.set(
				cluster.id,
				cluster.members.map((member) => ({
					clusterId: cluster.id,
					noteId: member.note_id,
					score: member.score,
				})),
			);
		}
		return input.clusters.length;
	}

	async listActiveClusters(): Promise<ClusterRow[]> {
		return [...this.clusters.values()].filter(
			(cluster) =>
				cluster.kind === "cluster" && !cluster.acceptedAt && !cluster.dismissedAt,
		);
	}

	async listAcceptedClusters(): Promise<ClusterRow[]> {
		return [...this.clusters.values()].filter(
			(cluster) =>
				cluster.kind === "cluster" && !!cluster.acceptedAt && !cluster.dismissedAt,
		);
	}

	async listActiveSuperClusters(): Promise<ClusterRow[]> {
		return [...this.clusters.values()].filter(
			(cluster) =>
				cluster.kind === "super_cluster" &&
				!cluster.acceptedAt &&
				!cluster.dismissedAt,
		);
	}

	async listAcceptedSuperClusters(): Promise<ClusterRow[]> {
		return [...this.clusters.values()].filter(
			(cluster) =>
				cluster.kind === "super_cluster" &&
				!!cluster.acceptedAt &&
				!cluster.dismissedAt,
		);
	}

	async listChildClusters(superClusterId: string): Promise<ClusterRow[]> {
		return [...this.clusters.values()].filter(
			(cluster) => cluster.kind === "cluster" && cluster.parentId === superClusterId,
		);
	}

	async listStandaloneAcceptedClusters(): Promise<ClusterRow[]> {
		return (await this.listAcceptedClusters()).filter((cluster) => !cluster.parentId);
	}

	async listClusterMembers(clusterId: string): Promise<ClusterMemberRow[]> {
		return this.members.get(clusterId) ?? [];
	}

	async addClusterMember(clusterId: string, noteId: string): Promise<void> {
		const members = this.members.get(clusterId) ?? [];
		if (members.some((member) => member.noteId === noteId)) return;
		this.members.set(clusterId, [
			...members,
			{ clusterId, noteId, score: 1 },
		]);
	}

	async removeClusterMember(clusterId: string, noteId: string): Promise<void> {
		this.members.set(
			clusterId,
			(this.members.get(clusterId) ?? []).filter((member) => member.noteId !== noteId),
		);
	}

	async deleteCluster(clusterId: string): Promise<void> {
		this.clusters.delete(clusterId);
		this.members.delete(clusterId);
	}

	async acceptCluster(clusterId: string, acceptedNoteId?: string): Promise<void> {
		const cluster = this.clusters.get(clusterId);
		if (!cluster) return;
		this.clusters.set(clusterId, {
			...cluster,
			acceptedAt: new Date().toISOString(),
			acceptedNoteId: acceptedNoteId ?? cluster.acceptedNoteId,
		});
	}

	async dismissCluster(clusterId: string): Promise<void> {
		const cluster = this.clusters.get(clusterId);
		if (!cluster) return;
		this.clusters.set(clusterId, {
			...cluster,
			dismissedAt: new Date().toISOString(),
		});
	}

	async renameCluster(clusterId: string, name: string): Promise<void> {
		const cluster = this.clusters.get(clusterId);
		if (!cluster) return;
		this.clusters.set(clusterId, { ...cluster, name });
	}

	async recordFeedback(input: {
		clusterId: string;
		eventType: string;
		eventData: Record<string, unknown>;
	}): Promise<ClusterFeedbackRow> {
		const row = {
			id: this.nextFeedbackId++,
			clusterId: input.clusterId,
			eventType: input.eventType,
			eventData: input.eventData,
			createdAt: new Date().toISOString(),
		};
		this.feedback.push(row);
		return row;
	}

	async listFeedback(): Promise<ClusterFeedbackRow[]> {
		return [...this.feedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}
}
