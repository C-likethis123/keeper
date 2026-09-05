import { isServerSyncConfigured } from "@/services/sync/config";
import { showSyncDebugToast } from "@/services/sync/debug";
import { listSyncNoteIds } from "@/services/sync/remoteSyncClient";
import { enqueueMissingLocalNotes } from "@/services/sync/syncOpQueue";

export async function queueMissingLegacyNotes(): Promise<number> {
	if (!isServerSyncConfigured()) return 0;

	try {
		const { noteIds } = await listSyncNoteIds();
		const queued = await enqueueMissingLocalNotes(noteIds);
		if (queued > 0) {
			showSyncDebugToast(`Sync queued ${queued} legacy notes`);
		}
		return queued;
	} catch (error) {
		console.warn("[SyncLegacyBackfillService] Legacy note scan failed:", error);
		return 0;
	}
}
