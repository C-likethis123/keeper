import { NOTE_GRID_PAGE_SIZE } from "@/constants/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import {
	importClustersFromFile,
	listAcceptedSubClusters,
	listAcceptedSuperClusters,
	listClusterMembers,
	listStandaloneAcceptedClusters,
} from "@/services/notes/clusterService";
import type { NoteSection } from "@/services/notes/indexDb/types";
import {
	getCachedQueryPromise,
	useSuspensePromise,
} from "@/services/notes/noteQueryCache";
import {
	type NoteIndexItem,
	NotesIndexService,
} from "@/services/notes/notesIndex";
import {
	notesIndexDbGetOrphanedNotes,
	notesIndexDbGetRecentlyEditedNotes,
} from "@/services/notes/notesIndexDb";
import type { Note, NoteListFilters } from "@/services/notes/types";
import { useFilterStore } from "@/stores/filterStore";
import { useStorageStore } from "@/stores/storageStore";
import { waitForStorageReady } from "@/stores/storageSuspense";
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
	useTransition,
} from "react";

function toNote(item: NoteIndexItem): Note {
	return {
		id: item.noteId,
		title: item.title,
		content: item.summary,
		lastUpdated: item.updatedAt,
		isPinned: item.isPinned,
		noteType: item.noteType ?? "note",
		status: item.status,
	};
}

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
		const loadedClusterNotes = allNotes.filter((note) => memberNoteIds.has(note.id));
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

function buildNotesQueryKey(args: {
	query: string;
	filters: NoteListFilters;
	contentVersion: number;
	refreshVersion: number;
}) {
	return JSON.stringify({
		scope: "notes",
		query: args.query,
		filters: args.filters,
		contentVersion: args.contentVersion,
		refreshVersion: args.refreshVersion,
	});
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

async function loadSectionMetadata() {
	await ensureClustersImported();

	const [
		recentlyEditedRows,
		orphanedIds,
		acceptedSuperClusters,
		standaloneClusters,
	] = await Promise.all([
		notesIndexDbGetRecentlyEditedNotes(10, 7),
		notesIndexDbGetOrphanedNotes(),
		listAcceptedSuperClusters(),
		listStandaloneAcceptedClusters(),
	]);

	const acceptedClusterSections: ClusterSectionMetadata[] = [];

	// Super-cluster sections: notes from all accepted child sub-clusters combined
	for (const superCluster of acceptedSuperClusters) {
		const subClusters = await listAcceptedSubClusters(superCluster.id);
		const seenNoteIds = new Set<string>();
		for (const subCluster of subClusters) {
			const members = await listClusterMembers(subCluster.id);
			for (const member of members) {
				seenNoteIds.add(member.note_id);
			}
		}
		if (seenNoteIds.size > 0) {
			acceptedClusterSections.push({
				id: superCluster.id,
				title: superCluster.name,
				memberNoteIds: [...seenNoteIds],
				superClusterId: superCluster.id,
			});
		}
	}

	// Standalone cluster sections (no super-cluster parent)
	for (const cluster of standaloneClusters) {
		const members = await listClusterMembers(cluster.id);
		const memberNoteIds = members.map((member) => member.note_id);
		if (memberNoteIds.length > 0) {
			acceptedClusterSections.push({
				id: cluster.id,
				title: cluster.name,
				memberNoteIds,
				clusterId: cluster.id,
			});
		}
	}

	return {
		recentlyEditedNoteIds: new Set(recentlyEditedRows.map((row) => row.id)),
		orphanedNoteIds: new Set(orphanedIds),
		acceptedClusterSections,
	};
}

let clustersImportPromise: Promise<number> | null = null;

function ensureClustersImported(): Promise<number> {
	clustersImportPromise ??= importClustersFromFile().catch((error) => {
		console.warn("[useNotes] importClustersFromFile failed:", error);
		return 0;
	});
	return clustersImportPromise;
}

async function loadSectionMetadataSafely() {
	try {
		return await loadSectionMetadata();
	} catch (error) {
		console.warn("[useNotes] loadSectionMetadata failed:", error);
		return {
			recentlyEditedNoteIds: new Set<string>(),
			orphanedNoteIds: new Set<string>(),
			acceptedClusterSections: [] as NoteSection[],
		};
	}
}

export default function useNotes() {
	const initializationStatus = useStorageStore((s) => s.initializationStatus);
	const initializationError = useStorageStore((s) => s.initializationError);
	const contentVersion = useStorageStore((s) => s.contentVersion);
	const deferredContentVersion = useDeferredValue(contentVersion);
	const [query, setQuery] = useState("");
	const debouncedQuery = useDebounce(query, 300);
	const deferredQuery = debouncedQuery;
	const noteTypeFilter = useFilterStore((s) => s.noteTypes);
	const statusFilter = useFilterStore((s) => s.status);
	const hideDone = useFilterStore((s) => s.hideDone);
	const setNoteTypeFilter = useFilterStore((s) => s.setNoteTypes);
	const setStatusFilter = useFilterStore((s) => s.setStatus);
	const [refreshVersion, setRefreshVersion] = useState(0);
	const [isRefreshing, startRefreshTransition] = useTransition();
	const [paginationState, setPaginationState] = useState<{
		baseKey: string;
		notes: Note[];
		nextOffset?: number;
		isLoadingMore: boolean;
		error: string | null;
	}>({
		baseKey: "",
		notes: [],
		nextOffset: undefined,
		isLoadingMore: false,
		error: null,
	});
	const filters = useMemo<NoteListFilters>(
		() => ({
			noteTypes: noteTypeFilter.length > 0 ? noteTypeFilter : undefined,
			status: statusFilter,
			hideDone,
		}),
		[noteTypeFilter, statusFilter, hideDone],
	);

	if (initializationStatus === "pending") {
		throw waitForStorageReady();
	}

	if (initializationStatus === "failed") {
		throw new Error(initializationError ?? "Storage is unavailable");
	}

	const baseKey = buildNotesQueryKey({
		query: deferredQuery,
		filters,
		contentVersion: deferredContentVersion,
		refreshVersion,
	});
	const basePromise = getCachedQueryPromise(baseKey, () =>
		loadNotesPage({
			query: deferredQuery,
			filters,
			offset: 0,
		}),
	);
	const sectionMetadataPromise = getCachedQueryPromise(
		`note-sections:${deferredContentVersion}:${refreshVersion}`,
		loadSectionMetadataSafely,
	);
	const baseResult = useSuspensePromise(basePromise);
	const sectionMetadata = useSuspensePromise(sectionMetadataPromise);
	const baseNotes = useMemo(() => baseResult.items.map(toNote), [baseResult]);
	const activePagination =
		paginationState.baseKey === baseKey
			? paginationState
			: {
					baseKey,
					notes: [],
					nextOffset: baseResult.cursor,
					isLoadingMore: false,
					error: null,
				};

	useEffect(() => {
		setPaginationState({
			baseKey,
			notes: [],
			nextOffset: baseResult.cursor,
			isLoadingMore: false,
			error: null,
		});
	}, [baseKey, baseResult.cursor]);

	const loadMoreNotes = useCallback(async () => {
		if (activePagination.isLoadingMore || activePagination.nextOffset == null) {
			return;
		}

		setPaginationState((current) =>
			current.baseKey === baseKey
				? {
						...current,
						isLoadingMore: true,
						error: null,
					}
				: current,
		);

		try {
			const result = await loadNotesPage({
				query: deferredQuery,
				filters,
				offset: activePagination.nextOffset,
			});
			setPaginationState((current) => {
				if (current.baseKey !== baseKey) {
					return current;
				}

				return {
					...current,
					notes: [...current.notes, ...result.items.map(toNote)],
					nextOffset: result.cursor,
					isLoadingMore: false,
				};
			});
		} catch (error) {
			setPaginationState((current) => {
				if (current.baseKey !== baseKey) {
					return current;
				}

				return {
					...current,
					isLoadingMore: false,
					error: error instanceof Error ? error.message : String(error),
				};
			});
		}
	}, [
		activePagination.isLoadingMore,
		activePagination.nextOffset,
		baseKey,
		deferredQuery,
		filters,
	]);

	const handleRefresh = useCallback(() => {
		startRefreshTransition(() => {
			setRefreshVersion((current) => current + 1);
		});
	}, []);

	const allNotes = useMemo(
		() => [...baseNotes, ...activePagination.notes],
		[baseNotes, activePagination.notes],
	);

	const sections = useMemo(() => {
		const pinnedNotes = allNotes.filter((n) => n.isPinned);
		const isFiltered =
			deferredQuery.trim().length > 0 ||
			(filters.noteTypes != null && filters.noteTypes.length > 0) ||
			filters.status != null ||
			(filters.hideDone ?? false);

		return computeSections(
			allNotes,
			pinnedNotes,
			sectionMetadata.recentlyEditedNoteIds,
			sectionMetadata.orphanedNoteIds,
			sectionMetadata.acceptedClusterSections,
			isFiltered,
		);
	}, [allNotes, sectionMetadata, deferredQuery, filters]);

	return {
		notes: allNotes,
		sections,
		hasMore: activePagination.nextOffset != null,
		isRefreshing,
		isLoadingMore: activePagination.isLoadingMore,
		loadMoreNotes,
		setQuery,
		noteTypeFilter,
		setNoteTypeFilter,
		statusFilter,
		setStatusFilter,
		query,
		error: activePagination.error,
		handleRefresh,
	};
}
