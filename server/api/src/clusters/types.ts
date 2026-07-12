export type ClusterRow = {
	id: string;
	name: string;
	confidence: number;
	createdAt: string;
	acceptedAt: string | null;
	dismissedAt: string | null;
	acceptedNoteId: string | null;
	parentId: string | null;
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
};

export type ClusterRepository = {
	importClusters(input: ClustersJson): Promise<number>;
	listActiveClusters(): Promise<ClusterRow[]>;
	listAcceptedClusters(): Promise<ClusterRow[]>;
	listClusterMembers(clusterId: string): Promise<ClusterMemberRow[]>;
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
