import { NOTES_ROOT } from "@/services/notes/Notes";
import { File } from "expo-file-system";
import {
	acceptCluster,
	acceptSuperCluster,
	addNoteToCluster,
	deleteCluster,
	dismissCluster,
	dismissSuperCluster,
	getAcceptedClusters,
	getAcceptedSubClusters,
	getAcceptedSuperClusters,
	getActiveClusters,
	getActiveSuperClusters,
	getClusterMembers,
	getStandaloneAcceptedClusters,
	removeNoteFromCluster,
	renameCluster,
	renameSuperCluster,
	upsertClustersFromJson,
	upsertSuperClustersFromJson,
	type ClusterMemberRow,
	type ClusterRow,
	type SuperClusterRow,
} from "./indexDb/repository";
import { getNotesIndexDb } from "./indexDb/db";

export type { ClusterRow, ClusterMemberRow, SuperClusterRow };

const CLUSTERS_FILENAME = ".moc_clusters.json";

interface ClustersJson {
	version: number;
	clusters: Array<{
		id: string;
		name: string;
		confidence: number;
		parent_id?: string | null;
		members: Array<{ note_id: string; score: number }>;
	}>;
	super_clusters?: Array<{
		id: string;
		name: string;
		confidence: number;
		child_cluster_ids: string[];
	}>;
}

export async function importClustersFromFile(): Promise<number> {
	const filePath = `${NOTES_ROOT}/${CLUSTERS_FILENAME}`;
	const file = new File(filePath);
	if (!file.exists) return 0;

	const raw = await file.text();
	let parsed: ClustersJson;
	try {
		parsed = JSON.parse(raw) as ClustersJson;
	} catch {
		return 0;
	}

	if (!Array.isArray(parsed.clusters)) return 0;

	const database = await getNotesIndexDb();

	if (parsed.version === 2 && Array.isArray(parsed.super_clusters)) {
		await upsertSuperClustersFromJson(database, parsed.super_clusters);
	}

	await upsertClustersFromJson(database, parsed.clusters);
	return parsed.clusters.length;
}

export async function listActiveClusters(): Promise<ClusterRow[]> {
	const database = await getNotesIndexDb();
	return getActiveClusters(database);
}

export async function listClusterMembers(
	clusterId: string,
): Promise<ClusterMemberRow[]> {
	const database = await getNotesIndexDb();
	return getClusterMembers(database, clusterId);
}

export async function clusterDismiss(clusterId: string): Promise<void> {
	const database = await getNotesIndexDb();
	await dismissCluster(database, clusterId);
}

export async function clusterAccept(clusterId: string): Promise<void> {
	const database = await getNotesIndexDb();
	await acceptCluster(database, clusterId);
}

export async function listAcceptedClusters(): Promise<ClusterRow[]> {
	const database = await getNotesIndexDb();
	return getAcceptedClusters(database);
}

export async function clusterRename(
	clusterId: string,
	name: string,
): Promise<void> {
	const database = await getNotesIndexDb();
	await renameCluster(database, clusterId, name);
}

export async function clusterAddNote(
	clusterId: string,
	noteId: string,
): Promise<void> {
	const database = await getNotesIndexDb();
	await addNoteToCluster(database, clusterId, noteId);
}

export async function clusterRemoveNote(
	clusterId: string,
	noteId: string,
): Promise<void> {
	const database = await getNotesIndexDb();
	await removeNoteFromCluster(database, clusterId, noteId);
}

export async function clusterDelete(clusterId: string): Promise<void> {
	const database = await getNotesIndexDb();
	await deleteCluster(database, clusterId);
}

// ─── Super-Cluster Service ────────────────────────────────────────────────────

export async function listActiveSuperClusters(): Promise<SuperClusterRow[]> {
	const database = await getNotesIndexDb();
	return getActiveSuperClusters(database);
}

export async function listAcceptedSuperClusters(): Promise<SuperClusterRow[]> {
	const database = await getNotesIndexDb();
	return getAcceptedSuperClusters(database);
}

export async function superClusterAccept(superClusterId: string): Promise<void> {
	const database = await getNotesIndexDb();
	await acceptSuperCluster(database, superClusterId);
}

export async function superClusterDismiss(superClusterId: string): Promise<void> {
	const database = await getNotesIndexDb();
	await dismissSuperCluster(database, superClusterId);
}

export async function superClusterRename(
	superClusterId: string,
	name: string,
): Promise<void> {
	const database = await getNotesIndexDb();
	await renameSuperCluster(database, superClusterId, name);
}

export async function listAcceptedSubClusters(
	superClusterId: string,
): Promise<ClusterRow[]> {
	const database = await getNotesIndexDb();
	return getAcceptedSubClusters(database, superClusterId);
}

export async function listStandaloneAcceptedClusters(): Promise<ClusterRow[]> {
	const database = await getNotesIndexDb();
	return getStandaloneAcceptedClusters(database);
}
