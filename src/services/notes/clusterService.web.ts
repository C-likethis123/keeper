import { getTauriInvoke } from "@/services/storage/runtime";
import type {
	ClusterMemberRow,
	ClusterRow,
	SuperClusterRow,
} from "./indexDb/repository";

export type { ClusterRow, ClusterMemberRow, SuperClusterRow };

type TauriClusterMemberRow = {
	clusterId: string;
	noteId: string;
	score: number;
};

function invoke<T>(
	command: string,
	args?: Record<string, unknown>,
): Promise<T> {
	const fn = getTauriInvoke();
	if (!fn) throw new Error("Tauri invoke unavailable");
	return fn<T>(command, args);
}

export async function importClustersFromFile(): Promise<number> {
	return invoke<number>("clusters_import");
}

export async function listActiveClusters(): Promise<ClusterRow[]> {
	return invoke<ClusterRow[]>("clusters_get_active");
}

export async function listClusterMembers(
	clusterId: string,
): Promise<ClusterMemberRow[]> {
	const rows = await invoke<TauriClusterMemberRow[]>("clusters_get_members", {
		clusterId,
	});
	return rows.map((r) => ({
		cluster_id: r.clusterId,
		note_id: r.noteId,
		score: r.score,
	}));
}

export async function clusterDismiss(clusterId: string): Promise<void> {
	await invoke("clusters_dismiss", { clusterId });
}

export async function clusterAccept(clusterId: string): Promise<void> {
	await invoke("clusters_accept", { clusterId });
}

export async function listAcceptedClusters(): Promise<ClusterRow[]> {
	return invoke<ClusterRow[]>("clusters_get_accepted");
}

export async function clusterRename(
	clusterId: string,
	name: string,
): Promise<void> {
	await invoke("clusters_rename", { clusterId, name });
}

export async function clusterAddNote(
	clusterId: string,
	noteId: string,
): Promise<void> {
	await invoke("clusters_add_note", { clusterId, noteId });
}

export async function clusterRemoveNote(
	clusterId: string,
	noteId: string,
): Promise<void> {
	await invoke("clusters_remove_note", { clusterId, noteId });
}

export async function clusterDelete(clusterId: string): Promise<void> {
	await invoke("clusters_delete", { clusterId });
}

// ─── Super-Cluster Service (Tauri stubs — pending Rust backend support) ──────

export async function listActiveSuperClusters(): Promise<SuperClusterRow[]> {
	return invoke<SuperClusterRow[]>("super_clusters_get_active");
}

export async function listAcceptedSuperClusters(): Promise<SuperClusterRow[]> {
	return invoke<SuperClusterRow[]>("super_clusters_get_accepted");
}

export async function superClusterAccept(superClusterId: string): Promise<void> {
	await invoke("super_clusters_accept", { superClusterId });
}

export async function superClusterDismiss(superClusterId: string): Promise<void> {
	await invoke("super_clusters_dismiss", { superClusterId });
}

export async function superClusterRename(
	superClusterId: string,
	name: string,
): Promise<void> {
	await invoke("super_clusters_rename", { superClusterId, name });
}

export async function listAcceptedSubClusters(
	superClusterId: string,
): Promise<ClusterRow[]> {
	return invoke<ClusterRow[]>("super_clusters_get_sub_clusters", {
		superClusterId,
	});
}

export async function listStandaloneAcceptedClusters(): Promise<ClusterRow[]> {
	return invoke<ClusterRow[]>("clusters_get_standalone_accepted");
}
