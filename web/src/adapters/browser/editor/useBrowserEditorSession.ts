import type { BrowserNote, BrowserNoteType } from "@/ui/noteRepository";
import { createEditorSessionDraft, patchEditorSessionDraft } from "@keeper/features/editor/session/editorSessionDraft";
import type { EditorSessionDraft } from "@keeper/features/editor/session/editorSessionContract";
import { useCallback, useEffect, useMemo, useState } from "react";

type BrowserSession = { source: BrowserNote; draft: EditorSessionDraft };
type SaveStatus = "idle" | "saving" | "saved";

function browserTypeToDraft(note: BrowserNote): EditorSessionDraft {
	return createEditorSessionDraft({ id: note.id, title: note.title, content: note.noteType === "video" || note.noteType === "document" ? "" : note.content, isPinned: note.isPinned, noteType: note.noteType === "drawing" ? "drawing" : "note", status: null, attachment: note.noteType === "document" ? note.content : null, attachedVideo: note.noteType === "video" ? note.content : null, resourceUrl: null, documentPositions: null });
}

function draftToBrowserNote(draft: EditorSessionDraft, source: BrowserNote): BrowserNote {
	const inferredType: BrowserNoteType = draft.noteType === "drawing" ? "drawing" : draft.attachedVideo ? "video" : draft.attachment ? "document" : "note";
	return { ...source, id: draft.id, title: draft.title, content: inferredType === "video" ? (draft.attachedVideo ?? "") : inferredType === "document" ? (draft.attachment ?? "") : draft.content, noteType: inferredType, isPinned: draft.isPinned, updatedAt: Date.now() };
}

export function useBrowserEditorSession(note: BrowserNote, port: { save: (note: BrowserNote) => Promise<void>; remove: (noteId: string) => Promise<void> }) {
	const [session, setSession] = useState<BrowserSession>(() => ({ source: note, draft: browserTypeToDraft(note) })); const [status, setStatus] = useState<SaveStatus>("idle");
	useEffect(() => { setSession({ source: note, draft: browserTypeToDraft(note) }); setStatus("idle"); }, [note]);
	const patch = useCallback((change: Partial<Omit<EditorSessionDraft, "id">>) => setSession((current) => { const draft = patchEditorSessionDraft(current.draft, change); return { source: draftToBrowserNote(draft, current.source), draft }; }), []);
	const patchBrowser = useCallback((change: Partial<BrowserNote>) => setSession((current) => { const source = { ...current.source, ...change, updatedAt: Date.now() }; return { source, draft: browserTypeToDraft(source) }; }), []);
	const save = useCallback(async () => { setStatus("saving"); try { await port.save(session.source); setStatus("saved"); } catch (error) { setStatus("idle"); throw error; } }, [port, session.source]);
	const remove = useCallback(() => port.remove(session.source.id), [port, session.source.id]);
	const restore = useCallback(async (version: BrowserNote) => { setSession({ source: version, draft: browserTypeToDraft(version) }); setStatus("saving"); await port.save(version); setStatus("saved"); }, [port]);
	return useMemo(() => ({ draft: session.draft, note: session.source, status, patch, patchBrowser, save, remove, restore }), [session, status, patch, patchBrowser, save, remove, restore]);
}
