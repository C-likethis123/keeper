import { NOTE_GRID_PAGE_SIZE } from "@/constants/pagination";
import type { NoteSection } from "@/services/notes/indexDb/types";
import { NotesIndexService } from "@/services/notes/notesIndex";
import type { Note, NoteListFilters } from "@/services/notes/types";

type ClusterSectionMetadata = Omit<NoteSection, "notes"> & {
	memberNoteIds: string[];
};

export function computeSections(
	allNotes: Note[],
	pinnedNotes: Note[],
	recentlyEditedNoteIds: Set<string>,
	orphanedNoteIds: Set<string>,
	acceptedClusterSections: ClusterSectionMetadata[],
	isFiltered: boolean,
): NoteSection[] {
	const sections: NoteSection[] = [];
	const shownNoteIds = new Set<string>();

	if (pinnedNotes.length > 0) {
		sections.push({ id: "pinned", title: "Pinned", notes: pinnedNotes });
		for (const note of pinnedNotes) shownNoteIds.add(note.id);
	}

	const recentlyEditedNotes = allNotes.filter(
		(n) => recentlyEditedNoteIds.has(n.id) && !shownNoteIds.has(n.id),
	);
	if (recentlyEditedNotes.length > 0) {
		sections.push({
			id: "recently-edited",
			title: "Recently Edited",
			notes: recentlyEditedNotes,
		});
		for (const note of recentlyEditedNotes) shownNoteIds.add(note.id);
	}

	for (const cs of acceptedClusterSections) {
		const memberNoteIds = new Set(cs.memberNoteIds);
		const loadedClusterNotes = allNotes.filter((note) =>
			memberNoteIds.has(note.id),
		);
		const clusterNotes = isFiltered
			? loadedClusterNotes.filter((note) => !shownNoteIds.has(note.id))
			: loadedClusterNotes;
		if (clusterNotes.length > 0) {
			sections.push({ ...cs, notes: clusterNotes });
			for (const note of clusterNotes) shownNoteIds.add(note.id);
		}
	}

	const uncategorizedNotes = allNotes.filter(
		(n) => orphanedNoteIds.has(n.id) && !shownNoteIds.has(n.id),
	);
	if (uncategorizedNotes.length > 0) {
		sections.push({
			id: "uncategorized",
			title: "Other notes",
			notes: uncategorizedNotes,
		});
		for (const note of uncategorizedNotes) shownNoteIds.add(note.id);
	}

	const allNotesSection = allNotes.filter((n) => !shownNoteIds.has(n.id));
	if (allNotesSection.length > 0) {
		sections.push({
			id: "all-notes",
			title: "All Notes",
			notes: allNotesSection,
		});
	}

	return sections;
}

export async function loadNotesPage(args: {
	query: string;
	filters: NoteListFilters;
	offset: number;
}) {
	return NotesIndexService.listNotes(
		args.query,
		NOTE_GRID_PAGE_SIZE,
		args.offset,
		args.filters,
	);
}
