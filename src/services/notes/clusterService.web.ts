import {
	listServerAcceptedClusters,
	listServerAcceptedSuperClusters,
	listServerActiveClusters,
	listServerActiveSuperClusters,
	listServerChildClusters,
	listServerClusterMembers,
	listServerStandaloneAcceptedClusters,
	serverClusterAccept,
	serverClusterAddNote,
	serverClusterDelete,
	serverClusterDismiss,
	serverClusterRemoveNote,
	serverClusterRename,
	shouldUseServerClusters,
} from "@/services/notes/serverClusterClient";
import type {
	ClusterMemberRow,
	ClusterRow,
	SuperClusterRow,
} from "./indexDb/repository";

export type { ClusterRow, ClusterMemberRow, SuperClusterRow };

export async function importClustersFromFile(): Promise<number> {
	return 0;
}

export async function listActiveClusters(): Promise<ClusterRow[]> {
	return shouldUseServerClusters() ? listServerActiveClusters() : [];
}

export async function listClusterMembers(
	clusterId: string,
): Promise<ClusterMemberRow[]> {
	return shouldUseServerClusters()
		? listServerClusterMembers(clusterId)
		: [];
}

export async function clusterDismiss(clusterId: string): Promise<void> {
	if (shouldUseServerClusters()) await serverClusterDismiss(clusterId);
}

export async function clusterAccept(clusterId: string): Promise<void> {
	if (shouldUseServerClusters()) await serverClusterAccept(clusterId);
}

export async function listAcceptedClusters(): Promise<ClusterRow[]> {
	return shouldUseServerClusters() ? listServerAcceptedClusters() : [];
}

export async function clusterRename(
	clusterId: string,
	name: string,
): Promise<void> {
	if (shouldUseServerClusters()) await serverClusterRename(clusterId, name);
}

export async function clusterAddNote(
	clusterId: string,
	noteId: string,
): Promise<void> {
	if (shouldUseServerClusters()) await serverClusterAddNote(clusterId, noteId);
}

export async function clusterRemoveNote(
	clusterId: string,
	noteId: string,
): Promise<void> {
	if (shouldUseServerClusters()) await serverClusterRemoveNote(clusterId, noteId);
}

export async function clusterDelete(clusterId: string): Promise<void> {
	if (shouldUseServerClusters()) await serverClusterDelete(clusterId);
}

export async function listActiveSuperClusters(): Promise<SuperClusterRow[]> {
	return shouldUseServerClusters() ? listServerActiveSuperClusters() : [];
}

export async function listAcceptedSuperClusters(): Promise<SuperClusterRow[]> {
	return shouldUseServerClusters() ? listServerAcceptedSuperClusters() : [];
}

export async function superClusterAccept(
	superClusterId: string,
): Promise<void> {
	if (shouldUseServerClusters()) await serverClusterAccept(superClusterId);
}

export async function superClusterDismiss(
	superClusterId: string,
): Promise<void> {
	if (shouldUseServerClusters()) await serverClusterDismiss(superClusterId);
}

export async function superClusterRename(
	superClusterId: string,
	name: string,
): Promise<void> {
	if (shouldUseServerClusters())
		await serverClusterRename(superClusterId, name);
}

export async function listAcceptedSubClusters(
	superClusterId: string,
): Promise<ClusterRow[]> {
	return shouldUseServerClusters()
		? listServerChildClusters(superClusterId)
		: [];
}

export async function listStandaloneAcceptedClusters(): Promise<ClusterRow[]> {
	return shouldUseServerClusters()
		? listServerStandaloneAcceptedClusters()
		: [];
}
