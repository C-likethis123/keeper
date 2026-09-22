import type { BrowserNote } from "@web/ui/noteRepository";
import {
	createEditorSessionDraft,
	patchEditorSessionDraft,
} from "@keeper/features/editor/session/editorSessionDraft";
import type { EditorSessionDraft } from "@keeper/features/editor/session/editorSessionContract";
import { useCallback, useEffect, useMemo, useState } from "react";

type BrowserSession = {
	source: BrowserNote;
	draft: EditorSessionDraft;
	dirty: boolean;
};
type SaveStatus = "idle" | "saving" | "saved";

function browserNoteToDraft(note: BrowserNote): EditorSessionDraft {
	return createEditorSessionDraft(note);
}

function draftToBrowserNote(
	draft: EditorSessionDraft,
	source: BrowserNote,
): BrowserNote {
	return { ...source, ...draft, lastUpdated: Date.now(), modified: Date.now() };
}

export function useBrowserEditorSession(
	note: BrowserNote,
	port: {
		save: (note: BrowserNote) => Promise<void>;
		remove: (noteId: string) => Promise<void>;
	},
) {
	const [session, setSession] = useState<BrowserSession>(() => ({
		source: note,
		draft: browserNoteToDraft(note),
		dirty: false,
	}));
	const [status, setStatus] = useState<SaveStatus>("idle");
	useEffect(() => {
		setSession((current) =>
			current.source.id !== note.id || !current.dirty
				? { source: note, draft: browserNoteToDraft(note), dirty: false }
				: current,
		);
	}, [note]);
	const patch = useCallback(
		(change: Partial<Omit<EditorSessionDraft, "id">>) =>
			setSession((current) => {
				const draft = patchEditorSessionDraft(current.draft, change);
				return {
					source: draftToBrowserNote(draft, current.source),
					draft,
					dirty: true,
				};
			}),
		[],
	);
	const patchBrowser = useCallback(
		(change: Partial<BrowserNote>) =>
			setSession((current) => {
				const timestamp = Date.now();
				const source = {
					...current.source,
					...change,
					lastUpdated: timestamp,
					modified: timestamp,
				};
				return { source, draft: browserNoteToDraft(source), dirty: true };
			}),
		[],
	);
	const save = useCallback(async () => {
		if (!session.dirty) return;
		const snapshot = session.source;
		setStatus("saving");
		try {
			await port.save(snapshot);
			setSession((current) =>
				current.source === snapshot ? { ...current, dirty: false } : current,
			);
			setStatus("saved");
		} catch (error) {
			setStatus("idle");
			throw error;
		}
	}, [port, session]);
	const remove = useCallback(
		() => port.remove(session.source.id),
		[port, session.source.id],
	);
	const restore = useCallback(
		async (version: BrowserNote) => {
			setSession({
				source: version,
				draft: browserNoteToDraft(version),
				dirty: false,
			});
			setStatus("saving");
			await port.save(version);
			setStatus("saved");
		},
		[port],
	);
	return useMemo(
		() => ({
			draft: session.draft,
			note: session.source,
			status,
			isDirty: session.dirty,
			patch,
			patchBrowser,
			save,
			remove,
			restore,
		}),
		[session, status, patch, patchBrowser, save, remove, restore],
	);
}
