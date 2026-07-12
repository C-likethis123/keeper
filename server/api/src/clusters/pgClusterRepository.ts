import pg from "pg";
import type {
	ClusterFeedbackRow,
	ClusterMemberRow,
	ClusterRepository,
	ClusterRow,
	ClustersJson,
} from "./types.js";

const { Pool } = pg;

type ClusterDbRow = {
	id: string;
	name: string;
	confidence: number;
	created_at: Date;
	accepted_at: Date | null;
	dismissed_at: Date | null;
	accepted_note_id: string | null;
	parent_id: string | null;
};

type ClusterMemberDbRow = {
	cluster_id: string;
	note_id: string;
	score: number;
};

type ClusterFeedbackDbRow = {
	id: number;
	cluster_id: string;
	event_type: string;
	event_data: Record<string, unknown>;
	created_at: Date;
};

function mapCluster(row: ClusterDbRow): ClusterRow {
	return {
		id: row.id,
		name: row.name,
		confidence: Number(row.confidence),
		createdAt: row.created_at.toISOString(),
		acceptedAt: row.accepted_at?.toISOString() ?? null,
		dismissedAt: row.dismissed_at?.toISOString() ?? null,
		acceptedNoteId: row.accepted_note_id,
		parentId: row.parent_id,
	};
}

function mapMember(row: ClusterMemberDbRow): ClusterMemberRow {
	return {
		clusterId: row.cluster_id,
		noteId: row.note_id,
		score: Number(row.score),
	};
}

function mapFeedback(row: ClusterFeedbackDbRow): ClusterFeedbackRow {
	return {
		id: row.id,
		clusterId: row.cluster_id,
		eventType: row.event_type,
		eventData: row.event_data,
		createdAt: row.created_at.toISOString(),
	};
}

export function createPgClusterRepository(databaseUrl: string): ClusterRepository {
	const pool = new Pool({ connectionString: databaseUrl });

	return {
		async importClusters(input: ClustersJson): Promise<number> {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				await client.query(
					"DELETE FROM clusters WHERE accepted_at IS NULL AND dismissed_at IS NULL",
				);
				for (const cluster of input.clusters) {
					await client.query(
						`INSERT INTO clusters (id, name, confidence, created_at, parent_id)
						 VALUES ($1, $2, $3, now(), $4)
						 ON CONFLICT (id) DO UPDATE SET
						   name = CASE WHEN clusters.accepted_at IS NOT NULL THEN clusters.name ELSE EXCLUDED.name END,
						   confidence = EXCLUDED.confidence,
						   parent_id = EXCLUDED.parent_id`,
						[
							cluster.id,
							cluster.name,
							cluster.confidence,
							cluster.parent_id ?? null,
						],
					);
					await client.query("DELETE FROM cluster_members WHERE cluster_id = $1", [
						cluster.id,
					]);
					for (const member of cluster.members) {
						await client.query(
							`INSERT INTO cluster_members (cluster_id, note_id, score)
							 VALUES ($1, $2, $3)
							 ON CONFLICT (cluster_id, note_id) DO UPDATE SET score = EXCLUDED.score`,
							[cluster.id, member.note_id, member.score],
						);
					}
				}
				await client.query("COMMIT");
				return input.clusters.length;
			} catch (error) {
				await client.query("ROLLBACK");
				throw error;
			} finally {
				client.release();
			}
		},
		async listActiveClusters(): Promise<ClusterRow[]> {
			const result = await pool.query<ClusterDbRow>(
				`SELECT id, name, confidence, created_at, accepted_at, dismissed_at, accepted_note_id, parent_id
				 FROM clusters
				 WHERE accepted_at IS NULL AND dismissed_at IS NULL
				 ORDER BY confidence DESC`,
			);
			return result.rows.map(mapCluster);
		},
		async listAcceptedClusters(): Promise<ClusterRow[]> {
			const result = await pool.query<ClusterDbRow>(
				`SELECT id, name, confidence, created_at, accepted_at, dismissed_at, accepted_note_id, parent_id
				 FROM clusters
				 WHERE accepted_at IS NOT NULL AND dismissed_at IS NULL
				 ORDER BY accepted_at DESC`,
			);
			return result.rows.map(mapCluster);
		},
		async listClusterMembers(clusterId: string): Promise<ClusterMemberRow[]> {
			const result = await pool.query<ClusterMemberDbRow>(
				"SELECT cluster_id, note_id, score FROM cluster_members WHERE cluster_id = $1 ORDER BY score DESC",
				[clusterId],
			);
			return result.rows.map(mapMember);
		},
		async acceptCluster(clusterId: string, acceptedNoteId?: string): Promise<void> {
			await pool.query(
				"UPDATE clusters SET accepted_at = now(), accepted_note_id = COALESCE($2, accepted_note_id) WHERE id = $1",
				[clusterId, acceptedNoteId ?? null],
			);
		},
		async dismissCluster(clusterId: string): Promise<void> {
			await pool.query("UPDATE clusters SET dismissed_at = now() WHERE id = $1", [
				clusterId,
			]);
		},
		async renameCluster(clusterId: string, name: string): Promise<void> {
			await pool.query("UPDATE clusters SET name = $2 WHERE id = $1", [
				clusterId,
				name,
			]);
		},
		async recordFeedback(input): Promise<ClusterFeedbackRow> {
			const result = await pool.query<ClusterFeedbackDbRow>(
				`INSERT INTO cluster_feedback (cluster_id, event_type, event_data, created_at)
				 VALUES ($1, $2, $3, now())
				 RETURNING id, cluster_id, event_type, event_data, created_at`,
				[input.clusterId, input.eventType, JSON.stringify(input.eventData)],
			);
			return mapFeedback(result.rows[0]);
		},
		async listFeedback(): Promise<ClusterFeedbackRow[]> {
			const result = await pool.query<ClusterFeedbackDbRow>(
				`SELECT id, cluster_id, event_type, event_data, created_at
				 FROM cluster_feedback
				 ORDER BY created_at DESC`,
			);
			return result.rows.map(mapFeedback);
		},
	};
}
