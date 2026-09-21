import type { BrowserNote } from "@/ui/noteRepository";
import { createEditorSessionDraft, patchEditorSessionDraft } from "@keeper/features/editor/session/editorSessionDraft";
import type { EditorSessionDraft } from "@keeper/features/editor/session/editorSessionContract";
import { useCallback, useEffect, useMemo, useState } from "react";

type BrowserSession = { source: BrowserNote; draft: EditorSessionDraft };
type SaveStatus = "idle" | "saving" | "saved";

function browserNoteToDraft(note: BrowserNote): EditorSessionDraft {
	return createEditorSessionDraft(note);
}

function draftToBrowserNote(draft: EditorSessionDraft, source: BrowserNote): BrowserNote {
	return { ...source, ...draft, lastUpdated: Date.now(), modified: Date.now() };
}

export function useBrowserEditorSession(note: BrowserNote, port: { save: (note: BrowserNote) => Promise<void>; remove: (noteId: string) => Promise<void> }) {
	const [session, setSession] = useState<BrowserSession>(() => ({ source: note, draft: browserNoteToDraft(note) })); const [status, setStatus] = useState<SaveStatus>("idle");
	useEffect(() => { setSession({ source: note, draft: browserNoteToDraft(note) }); setStatus("idle"); }, [note]);
	const patch = useCallback((change: Partial<Omit<EditorSessionDraft, "id">>) => setSession((current) => { const draft = patchEditorSessionDraft(current.draft, change); return { source: draftToBrowserNote(draft, current.source), draft }; }), []);
	const patchBrowser = useCallback((change: Partial<BrowserNote>) => setSession((current) => { const timestamp = Date.now(); const source = { ...current.source, ...change, lastUpdated: timestamp, modified: timestamp }; return { source, draft: browserNoteToDraft(source) }; }), []);
	const save = useCallback(async () => { setStatus("saving"); try { await port.save(session.source); setStatus("saved"); } catch (error) { setStatus("idle"); throw error; } }, [port, session.source]);
	const remove = useCallback(() => port.remove(session.source.id), [port, session.source.id]);
	const restore = useCallback(async (version: BrowserNote) => { setSession({ source: version, draft: browserNoteToDraft(version) }); setStatus("saving"); await port.save(version); setStatus("saved"); }, [port]);
	return useMemo(() => ({ draft: session.draft, note: session.source, status, patch, patchBrowser, save, remove, restore }), [session, status, patch, patchBrowser, save, remove, restore]);
}
