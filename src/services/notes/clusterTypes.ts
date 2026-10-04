export interface SuperClusterRow {
	id: string;
	name: string;
	confidence: number;
	created_at: number;
	dismissed_at: number | null;
	accepted_at: number | null;
}

export interface ClusterRow {
	id: string;
	name: string;
	confidence: number;
	created_at: number;
	dismissed_at: number | null;
	accepted_at: number | null;
	accepted_note_id: string | null;
	parent_id: string | null;
}

export interface ClusterMemberRow {
	cluster_id: string;
	note_id: string;
	score: number;
}
