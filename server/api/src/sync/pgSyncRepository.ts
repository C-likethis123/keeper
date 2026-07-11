import pg from "pg";
import { SyncConflictError } from "./errors.js";
import type {
	SyncOperation,
	SyncPushInput,
	SyncPushResult,
	SyncRepository,
} from "./types.js";

type ExistingDeviceSeqRow = {
	op_id: string;
	payload: SyncOperation;
};

const { Pool } = pg;

export function createPgSyncRepository(databaseUrl: string): SyncRepository {
	const pool = new Pool({
		connectionString: databaseUrl,
	});

	return {
		async pushOperations(input: SyncPushInput): Promise<SyncPushResult> {
			const client = await pool.connect();
			const accepted: string[] = [];
			const duplicates: string[] = [];
			let cursor: number | null = null;

			try {
				await client.query("BEGIN");
				await client.query(
					`INSERT INTO devices (id, name, created_at)
					 VALUES ($1, $2, now())
					 ON CONFLICT (id) DO UPDATE SET name = COALESCE(EXCLUDED.name, devices.name)`,
					[input.deviceId, input.deviceName ?? null],
				);

				const operations = [...input.ops].sort((a, b) => a.seq - b.seq);

				for (const operation of operations) {
					const existingOp = await client.query<{ id: number }>(
						"SELECT id FROM sync_ops WHERE op_id = $1",
						[operation.opId],
					);

					if (existingOp.rowCount && existingOp.rows[0]) {
						duplicates.push(operation.opId);
						cursor = Math.max(cursor ?? 0, existingOp.rows[0].id);
						continue;
					}

					const existingDeviceSeq =
						await client.query<ExistingDeviceSeqRow>(
							`SELECT op_id, payload
							 FROM sync_ops
							 WHERE device_id = $1 AND device_seq = $2`,
							[input.deviceId, operation.seq],
						);

					if (existingDeviceSeq.rowCount && existingDeviceSeq.rows[0]) {
						throw new SyncConflictError(
							`device sequence already used by ${existingDeviceSeq.rows[0].op_id}`,
						);
					}

					const inserted = await client.query<{ id: number }>(
						`INSERT INTO sync_ops (op_id, device_id, device_seq, type, note_id, payload, created_at)
						 VALUES ($1, $2, $3, $4, $5, $6, now())
						 RETURNING id`,
						[
							operation.opId,
							input.deviceId,
							operation.seq,
							operation.type,
							operation.noteId,
							JSON.stringify(operation),
						],
					);

					await applyOperation(client, operation);
					accepted.push(operation.opId);
					cursor = inserted.rows[0]?.id ?? cursor;
				}

				await client.query("COMMIT");

				return {
					accepted,
					duplicates,
					cursor,
				};
			} catch (error) {
				await client.query("ROLLBACK");
				if (
					typeof error === "object" &&
					error !== null &&
					"code" in error &&
					(error as { code?: string }).code === "23505"
				) {
					throw new SyncConflictError("operation conflicts with existing note");
				}
				throw error;
			} finally {
				client.release();
			}
		},
	};
}

async function applyOperation(
	client: pg.PoolClient,
	operation: SyncOperation,
): Promise<void> {
	switch (operation.type) {
		case "note.create":
			await client.query(
				`INSERT INTO notes (id, path, title, markdown, created_at, updated_at, deleted_at, version)
				 VALUES ($1, $2, $3, $4, $5, $5, NULL, 1)`,
				[
					operation.noteId,
					operation.path,
					operation.title,
					operation.markdown,
					operation.createdAt,
				],
			);
			return;
		case "note.update":
			await applyLiveNoteUpdate(
				client,
				`UPDATE notes
				 SET markdown = $2,
				     updated_at = $3,
				     version = version + 1
				 WHERE id = $1 AND deleted_at IS NULL`,
				[operation.noteId, operation.markdown, operation.updatedAt],
			);
			return;
		case "note.rename":
			await applyLiveNoteUpdate(
				client,
				`UPDATE notes
				 SET path = $2,
				     title = $3,
				     updated_at = $4,
				     version = version + 1
				 WHERE id = $1 AND deleted_at IS NULL`,
				[
					operation.noteId,
					operation.path,
					operation.title,
					operation.updatedAt,
				],
			);
			return;
		case "note.delete":
			await applyLiveNoteUpdate(
				client,
				`UPDATE notes
				 SET deleted_at = $2,
				     updated_at = $2,
				     version = version + 1
				 WHERE id = $1 AND deleted_at IS NULL`,
				[operation.noteId, operation.deletedAt],
			);
			return;
	}
}

async function applyLiveNoteUpdate(
	client: pg.PoolClient,
	sql: string,
	values: unknown[],
): Promise<void> {
	const result = await client.query(sql, values);
	if (result.rowCount === 0) {
		throw new SyncConflictError("note does not exist or is deleted");
	}
}
