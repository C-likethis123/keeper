import {
	listServerAcceptedClusters,
	listServerActiveClusters,
	listServerClusterMembers,
	serverClusterAccept,
	serverClusterAddNote,
	serverClusterDismiss,
	serverClusterRename,
	shouldUseServerClusters,
} from "@/services/notes/serverClusterClient";
import type { ClusterMemberRow, ClusterRow } from "./clusterTypes";

export type { ClusterRow };

export async function listActiveClusters(): Promise<ClusterRow[]> {
	return shouldUseServerClusters() ? listServerActiveClusters() : [];
}

export async function listClusterMembers(
	clusterId: string,
): Promise<ClusterMemberRow[]> {
	return shouldUseServerClusters() ? listServerClusterMembers(clusterId) : [];
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
