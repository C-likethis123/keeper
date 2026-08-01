export type ClusterRow = {
	id: string;
	name: string;
	confidence: number;
	createdAt: string;
	acceptedAt: string | null;
	dismissedAt: string | null;
	acceptedNoteId: string | null;
	parentId: string | null;
	kind: "cluster" | "super_cluster";
};

export type ClusterMemberRow = {
	clusterId: string;
	noteId: string;
	score: number;
};

export type ClusterFeedbackRow = {
	id: number;
	clusterId: string;
	eventType: string;
	eventData: Record<string, unknown>;
	createdAt: string;
};

export type ClustersJson = {
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
};

export type ClusterRepository = {
	importClusters(input: ClustersJson): Promise<number>;
	listActiveClusters(): Promise<ClusterRow[]>;
	listAcceptedClusters(): Promise<ClusterRow[]>;
	listActiveSuperClusters(): Promise<ClusterRow[]>;
	listAcceptedSuperClusters(): Promise<ClusterRow[]>;
	listChildClusters(superClusterId: string): Promise<ClusterRow[]>;
	listStandaloneAcceptedClusters(): Promise<ClusterRow[]>;
	listClusterMembers(clusterId: string): Promise<ClusterMemberRow[]>;
	addClusterMember(clusterId: string, noteId: string): Promise<void>;
	removeClusterMember(clusterId: string, noteId: string): Promise<void>;
	deleteCluster(clusterId: string): Promise<void>;
	acceptCluster(clusterId: string, acceptedNoteId?: string): Promise<void>;
	dismissCluster(clusterId: string): Promise<void>;
	renameCluster(clusterId: string, name: string): Promise<void>;
	recordFeedback(input: {
		clusterId: string;
		eventType: string;
		eventData: Record<string, unknown>;
	}): Promise<ClusterFeedbackRow>;
	listFeedback(): Promise<ClusterFeedbackRow[]>;
};
