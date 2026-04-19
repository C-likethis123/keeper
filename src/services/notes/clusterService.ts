import { NOTES_ROOT } from "@/services/notes/Notes";
import { File } from "expo-file-system";
import {
	acceptCluster,
	dismissCluster,
	getAcceptedClusters,
	getActiveClusters,
	getClusterMembers,
	renameCluster,
	upsertClustersFromJson,
	type ClusterMemberRow,
	type ClusterRow,
} from "./indexDb/repository";
import { getNotesIndexDb } from "./indexDb/db";

export type { ClusterRow, ClusterMemberRow };

const CLUSTERS_FILENAME = ".moc_clusters.json";

interface ClustersJson {
	version: number;
	clusters: Array<{
		id: string;
		name: string;
		confidence: number;
		members: Array<{ note_id: string; score: number }>;
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
