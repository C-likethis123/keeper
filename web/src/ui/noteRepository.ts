import { browserStorage } from "@/services/storage";

export type BrowserNoteType = "note" | "document" | "video" | "drawing";

export type BrowserNote = {
	id: string;
	title: string;
	content: string;
	noteType: BrowserNoteType;
	isPinned: boolean;
	updatedAt: number;
};

const NOTES_KEY = "notes:v1";

export async function loadBrowserNotes(): Promise<BrowserNote[]> {
	const serialized = await browserStorage.getState(NOTES_KEY);
	if (!serialized) return [];
	try {
		const notes: unknown = JSON.parse(serialized);
		return Array.isArray(notes) ? (notes as BrowserNote[]) : [];
	} catch {
		return [];
	}
}

export async function persistBrowserNotes(notes: BrowserNote[]): Promise<void> {
	await browserStorage.setState(NOTES_KEY, JSON.stringify(notes));
}
