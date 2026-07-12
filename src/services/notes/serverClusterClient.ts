import { getSyncServerUrl, isServerSyncEnabled } from "@/services/sync/config";
import type {
	ClusterMemberRow,
	ClusterRow,
} from "@/services/notes/indexDb/repository";

type ServerClusterRow = {
	id: string;
	name: string;
	confidence: number;
	createdAt: string;
	acceptedAt: string | null;
	dismissedAt: string | null;
	acceptedNoteId: string | null;
	parentId: string | null;
};

type ServerClusterMemberRow = {
	clusterId: string;
	noteId: string;
	score: number;
};

function parseTime(value: string | null): number | null {
	if (!value) return null;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function mapCluster(row: ServerClusterRow): ClusterRow {
	return {
		id: row.id,
		name: row.name,
		confidence: row.confidence,
		created_at: parseTime(row.createdAt) ?? 0,
		accepted_at: parseTime(row.acceptedAt),
		dismissed_at: parseTime(row.dismissedAt),
		accepted_note_id: row.acceptedNoteId,
		parent_id: row.parentId,
	};
}

function mapMember(row: ServerClusterMemberRow): ClusterMemberRow {
	return {
		cluster_id: row.clusterId,
		note_id: row.noteId,
		score: row.score,
	};
}

export function shouldUseServerClusters(): boolean {
	return isServerSyncEnabled() && !!getSyncServerUrl();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const serverUrl = getSyncServerUrl();
	if (!serverUrl) throw new Error("Sync server URL is not configured");
	const response = await fetch(`${serverUrl}${path}`, init);
	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(
			`Cluster request failed with ${response.status}${body ? `: ${body}` : ""}`,
		);
	}
	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
}

export async function listServerActiveClusters(): Promise<ClusterRow[]> {
	const rows = await request<ServerClusterRow[]>("/clusters/active");
	return rows.map(mapCluster);
}

export async function listServerAcceptedClusters(): Promise<ClusterRow[]> {
	const rows = await request<ServerClusterRow[]>("/clusters/accepted");
	return rows.map(mapCluster);
}

export async function listServerClusterMembers(
	clusterId: string,
): Promise<ClusterMemberRow[]> {
	const rows = await request<ServerClusterMemberRow[]>(
		`/clusters/${encodeURIComponent(clusterId)}/members`,
	);
	return rows.map(mapMember);
}

export async function serverClusterAccept(clusterId: string): Promise<void> {
	await request(`/clusters/${encodeURIComponent(clusterId)}/accept`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({}),
	});
}

export async function serverClusterDismiss(clusterId: string): Promise<void> {
	await request(`/clusters/${encodeURIComponent(clusterId)}/dismiss`, {
		method: "POST",
	});
}

export async function serverClusterRename(
	clusterId: string,
	name: string,
): Promise<void> {
	await request(`/clusters/${encodeURIComponent(clusterId)}/rename`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	});
}

export async function logServerClusterFeedback(
	clusterId: string,
	eventType: string,
	eventData: Record<string, unknown>,
): Promise<void> {
	await request(`/clusters/${encodeURIComponent(clusterId)}/feedback`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ eventType, eventData }),
	});
}
