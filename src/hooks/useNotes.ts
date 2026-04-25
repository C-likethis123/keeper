import { PAGE_SIZE } from "@/constants/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import type { NoteSection } from "@/services/notes/indexDb/types";
import { getCachedQueryPromise } from "@/services/notes/noteQueryCache";
import {
  listAcceptedSubClusters,
  listAcceptedSuperClusters,
  listClusterMembers,
  listStandaloneAcceptedClusters,
} from "@/services/notes/clusterService";
import {
  type NoteIndexItem,
  NotesIndexService,
} from "@/services/notes/notesIndex";
import {
  notesIndexDbGetById,
  notesIndexDbGetOrphanedNotes,
  notesIndexDbGetRecentlyEditedNotes,
} from "@/services/notes/notesIndexDb";
import type { Note, NoteListFilters } from "@/services/notes/types";
import { useFilterStore } from "@/stores/filterStore";
import { useStorageStore } from "@/stores/storageStore";
import { waitForStorageReady } from "@/stores/storageSuspense";
import {
  startTransition,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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

function computeSections(
  allNotes: Note[],
  pinnedNotes: Note[],
  recentlyEditedNoteIds: Set<string>,
  orphanedNoteIds: Set<string>,
  acceptedClusterSections: NoteSection[],
  isFiltered: boolean,
): NoteSection[] {
  const sections: NoteSection[] = [];
  const shownNoteIds = new Set<string>();
  const allNoteIds = isFiltered ? new Set(allNotes.map((n) => n.id)) : null;

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
    // When filtered, intersect with the matching note set and deduplicate.
    // When not filtered, show ALL cluster members so that pinned/recently-edited
    // notes are still visible in their cluster section, and excludeNoteIds in
    // the AddNoteToClusterModal correctly reflects the full membership.
    const clusterNotes = allNoteIds
      ? cs.notes.filter((n) => allNoteIds.has(n.id) && !shownNoteIds.has(n.id))
      : cs.notes;
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

async function loadNotesPage(args: {
  query: string;
  filters: NoteListFilters;
  offset: number;
}) {
  return NotesIndexService.listNotes(
    args.query,
    PAGE_SIZE,
    args.offset,
    args.filters,
  );
}

function noteFromIndexItem(item: {
  noteId: string;
  title: string;
  summary: string;
  updatedAt: number;
  isPinned: boolean;
  noteType: Note["noteType"] | null;
  status?: Note["status"] | null;
}): Note {
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

async function loadSectionMetadata() {
  const [recentlyEditedRows, orphanedIds, acceptedSuperClusters, standaloneClusters] =
    await Promise.all([
      notesIndexDbGetRecentlyEditedNotes(10, 7),
      notesIndexDbGetOrphanedNotes(),
      listAcceptedSuperClusters(),
      listStandaloneAcceptedClusters(),
    ]);

  const acceptedClusterSections: NoteSection[] = [];

  // Super-cluster sections: notes from all accepted child sub-clusters combined
  for (const superCluster of acceptedSuperClusters) {
    const subClusters = await listAcceptedSubClusters(superCluster.id);
    const seenNoteIds = new Set<string>();
    const notes: Note[] = [];
    for (const subCluster of subClusters) {
      const members = await listClusterMembers(subCluster.id);
      for (const member of members) {
        if (seenNoteIds.has(member.note_id)) continue;
        const item = await notesIndexDbGetById(member.note_id);
        if (item) {
          notes.push(noteFromIndexItem(item));
          seenNoteIds.add(member.note_id);
        }
      }
    }
    if (notes.length > 0) {
      acceptedClusterSections.push({
        id: superCluster.id,
        title: superCluster.name,
        notes,
        superClusterId: superCluster.id,
      });
    }
  }

  // Standalone cluster sections (no super-cluster parent)
  for (const cluster of standaloneClusters) {
    const members = await listClusterMembers(cluster.id);
    const notes: Note[] = [];
    for (const member of members) {
      const item = await notesIndexDbGetById(member.note_id);
      if (item) {
        notes.push(noteFromIndexItem(item));
      }
    }
    if (notes.length > 0) {
      acceptedClusterSections.push({
        id: cluster.id,
        title: cluster.name,
        notes,
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

export default function useNotes() {
  const initializationStatus = useStorageStore((s) => s.initializationStatus);
  const initializationError = useStorageStore((s) => s.initializationError);
  const contentVersion = useStorageStore((s) => s.contentVersion);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const noteTypeFilter = useFilterStore((s) => s.noteTypes);
  const statusFilter = useFilterStore((s) => s.status);
  const hideDone = useFilterStore((s) => s.hideDone);
  const setNoteTypeFilter = useFilterStore((s) => s.setNoteTypes);
  const setStatusFilter = useFilterStore((s) => s.setStatus);
  const [refreshVersion, setRefreshVersion] = useState(0);
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
  const [sectionMetadata, setSectionMetadata] = useState<{
    recentlyEditedNoteIds: Set<string>;
    orphanedNoteIds: Set<string>;
    acceptedClusterSections: NoteSection[];
  }>({
    recentlyEditedNoteIds: new Set(),
    orphanedNoteIds: new Set(),
    acceptedClusterSections: [],
  });
  const sectionRequestVersionRef = useRef(0);

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
    query: debouncedQuery,
    filters,
    contentVersion,
    refreshVersion,
  });
  const baseResult = use(
    getCachedQueryPromise(baseKey, () =>
      loadNotesPage({
        query: debouncedQuery,
        filters,
        offset: 0,
      }),
    ),
  );
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
        query: debouncedQuery,
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
    debouncedQuery,
    filters,
  ]);

  const handleRefresh = useCallback(async () => {
    startTransition(() => {
      setRefreshVersion((current) => current + 1);
    });
  }, []);

  const allNotes = useMemo(
    () => [...baseNotes, ...activePagination.notes],
    [baseNotes, activePagination.notes],
  );

  useEffect(() => {
    void contentVersion;
    void refreshVersion;

    const requestVersion = sectionRequestVersionRef.current + 1;
    sectionRequestVersionRef.current = requestVersion;

    let cancelled = false;

    void loadSectionMetadata()
      .then((metadata) => {
        if (cancelled) {
          return;
        }
        if (sectionRequestVersionRef.current !== requestVersion) {
          return;
        }
        setSectionMetadata(metadata);
      })
      .catch((err) => {
        console.warn("[useNotes] loadSectionMetadata failed:", err);
        if (cancelled) {
          return;
        }
        if (sectionRequestVersionRef.current !== requestVersion) {
          return;
        }
        setSectionMetadata({
          recentlyEditedNoteIds: new Set(),
          orphanedNoteIds: new Set(),
          acceptedClusterSections: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [contentVersion, refreshVersion]);

  const sections = useMemo(() => {
    const pinnedNotes = allNotes.filter((n) => n.isPinned);
    const isFiltered =
      debouncedQuery.trim().length > 0 ||
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
  }, [allNotes, sectionMetadata, debouncedQuery, filters]);

  return {
    notes: allNotes,
    sections,
    hasMore: activePagination.nextOffset != null,
    isLoading: activePagination.isLoadingMore,
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
