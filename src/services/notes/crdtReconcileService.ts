import { NoteService } from "./noteService";
import {
	listCrdtNoteIds,
	readCrdtMarkdown,
} from "./crdtNoteService";

export interface CrdtReconcileResult {
	updatedNoteIds: string[];
}

export async function reconcileCrdtSnapshots(): Promise<CrdtReconcileResult> {
	const updatedNoteIds: string[] = [];
	const noteIds = await listCrdtNoteIds();

	for (const noteId of noteIds) {
		const [note, crdtMarkdown] = await Promise.all([
			NoteService.loadNote(noteId),
			readCrdtMarkdown(noteId),
		]);
		if (!note || crdtMarkdown === null || note.content === crdtMarkdown) {
			continue;
		}

		await NoteService.saveCrdtSnapshot({
			...note,
			content: crdtMarkdown,
		});
		updatedNoteIds.push(noteId);
	}

	return { updatedNoteIds };
}
