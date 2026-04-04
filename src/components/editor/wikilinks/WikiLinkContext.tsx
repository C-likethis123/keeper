import { PAGE_SIZE } from "@/constants/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { NoteService } from "@/services/notes/noteService";
import { NotesIndexService } from "@/services/notes/notesIndex";
import type { NoteType } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { nanoid } from "nanoid";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { GestureResponderEvent } from "react-native";
import { buildTrackedTodoTitle, normalizeWikiLinkTitle } from "./wikiLinkUtils";

export interface WikiLinkResult {
	id: string;
	type: "existing" | "create";
	title: string;
	noteId?: string;
}

interface WikiLinkContextValue {
	results: WikiLinkResult[];
	selectedIndex: number;
	isActive: boolean;
	isLoading: boolean;
	query: string;

	handleTriggerStart: (
		blockIndex: number,
		triggerStartOffset: number,
		initialQuery: string,
		options?: WikiLinkSessionOptions,
	) => void;
	handleQueryUpdate: (query: string) => void;
	handleCancel: () => void;
	handleSelect: (result: WikiLinkResult) => void;

	selectNext: () => void;
	selectPrevious: () => void;
	getSelectedResult: () => WikiLinkResult | null;

	// Actions (Drawer)
	actionsWikiLink: { title: string; event: GestureResponderEvent } | null;
	showActions: (title: string, event: GestureResponderEvent) => void;
	hideActions: () => void;
}

interface WikiLinkSessionOptions {
	createNoteType?: NoteType;
	replacementToken?: string;
	titleMode?: "note" | "trackedTodo";
}

const WikiLinkContext = createContext<WikiLinkContextValue | null>(null);

export function WikiLinkProvider({ children }: { children: React.ReactNode }) {
	const [isActive, setIsActive] = useState<boolean>(false);
	const [query, setQuery] = useState<string>("");
	const debouncedQuery = useDebounce(query, 300);
	const [results, setResults] = useState<WikiLinkResult[]>([]);
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [actionsWikiLink, setActionsWikiLink] = useState<{
		title: string;
		event: GestureResponderEvent;
	} | null>(null);
	const blockIndexRef = useRef<number>(0);
	const triggerStartOffsetRef = useRef<number>(0);
	const replacementTokenRef = useRef("[[");
	const createNoteTypeRef = useRef<NoteType>("note");
	const titleModeRef = useRef<WikiLinkSessionOptions["titleMode"]>("note");

	const transformTitle = useCallback((title: string) => {
		const trimmed = title.trim();
		return titleModeRef.current === "trackedTodo"
			? buildTrackedTodoTitle(trimmed)
			: trimmed;
	}, []);

	const endSession = useCallback(() => {
		setIsActive(false);
		setQuery("");
		setResults([]);
		setSelectedIndex(0);
		setIsLoading(false);
		// After the modal dismisses, the block TextInput loses native focus.
		// Cycle selection through null so UnifiedBlock's useLayoutEffect
		// sees isFocused transition false→true and calls inputRef.focus().
		const targetSel = useEditorState.getState().selection;
		if (targetSel) {
			setTimeout(() => {
				useEditorState.getState().setSelection(null);
				requestAnimationFrame(() => {
					useEditorState.getState().setSelection(targetSel);
				});
			}, 0);
		}
	}, []);

	const updateBlockContent = useEditorState((s) => s.updateBlockContent);

	const removeTriggerToken = useCallback(
		(selectionOffset?: number) => {
			const doc = useEditorState.getState().document;
			const block = doc.blocks[blockIndexRef.current];
			if (!block) return false;
			const start = triggerStartOffsetRef.current;
			const replacementToken = replacementTokenRef.current;
			if (
				block.content.substring(start, start + replacementToken.length) !==
				replacementToken
			) {
				return false;
			}
			const newText = `${block.content.substring(0, start)}${block.content.substring(start + replacementToken.length)}`;
			updateBlockContent(blockIndexRef.current, newText, selectionOffset);
			return true;
		},
		[updateBlockContent],
	);

	const handleTriggerStart = useCallback(
		(
			blockIndex: number,
			triggerStartOffset: number,
			initialQuery: string,
			options?: WikiLinkSessionOptions,
		) => {
			if (isActive) return;
			blockIndexRef.current = blockIndex;
			triggerStartOffsetRef.current = triggerStartOffset;
			replacementTokenRef.current = options?.replacementToken ?? "[[";
			createNoteTypeRef.current = options?.createNoteType ?? "note";
			titleModeRef.current = options?.titleMode ?? "note";
			const doc = useEditorState.getState().document;
			const block = doc.blocks[blockIndex];
			const replacementToken = replacementTokenRef.current;
			const trimmed = `${block?.content.substring(0, triggerStartOffset) ?? ""}${replacementToken}`;
			if (block && block.content !== trimmed) {
				updateBlockContent(blockIndex, trimmed);
			}
			setIsActive(true);
			setQuery(initialQuery);
			setResults([]);
			setSelectedIndex(0);
			setIsLoading(false);
		},
		[isActive, updateBlockContent],
	);

	const handleCancel = useCallback(() => {
		if (!isActive) return;
		removeTriggerToken(triggerStartOffsetRef.current);
		endSession();
	}, [endSession, isActive, removeTriggerToken]);

	const showActions = useCallback(
		(title: string, event: GestureResponderEvent) => {
			setActionsWikiLink({ title, event });
		},
		[],
	);

	const hideActions = useCallback(() => {
		setActionsWikiLink(null);
	}, []);

	const insertWikiLink = useCallback(
		(title: string) => {
			const doc = useEditorState.getState().document;
			const block = doc.blocks[blockIndexRef.current];
			if (!block) return;

			const start = triggerStartOffsetRef.current;
			const replacementToken = replacementTokenRef.current;
			const newText = `${block.content.substring(0, start)}[[${title}]]${block.content.substring(start + replacementToken.length)}`;
			const cursorAfter = start + title.length + 4;

			updateBlockContent(blockIndexRef.current, newText, cursorAfter);
		},
		[updateBlockContent],
	);

	useEffect(() => {
		if (!isActive) {
			return;
		}

		setIsLoading(true);

		const fetchResults = async () => {
			try {
				const result = await NotesIndexService.listNotes(
					debouncedQuery,
					PAGE_SIZE,
					0,
				);
				const nextResults: WikiLinkResult[] = [];
				const seenTitles = new Set<string>();
				const normalizedQuery = normalizeWikiLinkTitle(
					transformTitle(debouncedQuery),
				);
				let hasExactMatch = false;

				for (const item of result.items) {
					const title = item.title?.trim();
					if (!title) continue;
					const normalizedTitle = normalizeWikiLinkTitle(title);
					if (seenTitles.has(normalizedTitle)) continue;
					seenTitles.add(normalizedTitle);
					if (normalizedTitle === normalizedQuery) {
						hasExactMatch = true;
					}
					nextResults.push({
						id: item.noteId,
						type: "existing",
						title,
						noteId: item.noteId,
					});
				}

				if (normalizedQuery.length > 0 && !hasExactMatch) {
					const createTitle = transformTitle(debouncedQuery);
					nextResults.unshift({
						id: `create:${normalizedQuery}`,
						type: "create",
						title: createTitle,
					});
				}

				setResults(nextResults);
				setSelectedIndex(0);
			} catch (error) {
				console.warn("Failed to search notes:", error);
				setResults([]);
			} finally {
				setIsLoading(false);
			}
		};

		fetchResults();
	}, [debouncedQuery, isActive, transformTitle]);

	const handleQueryUpdate = setQuery;

	const handleSelect = useCallback(
		async (result: WikiLinkResult) => {
			if (!isActive) return;
			insertWikiLink(result.title);
			if (result.type === "create") {
				try {
					const now = Date.now();
					await NoteService.saveNote(
						{
							id: nanoid(),
							title: result.title,
							content: "",
							isPinned: false,
							noteType: createNoteTypeRef.current,
							status: createNoteTypeRef.current === "todo" ? "open" : null,
							createdAt: createNoteTypeRef.current === "todo" ? now : null,
							completedAt: null,
						},
						true,
					);
				} catch (error) {
					console.warn("Failed to create note from wiki link:", error);
				}
			}
			endSession();
		},
		[isActive, endSession, insertWikiLink],
	);

	const selectNext = useCallback(() => {
		if (results.length === 0) return;
		setSelectedIndex((prev) => (prev + 1) % results.length);
	}, [results.length]);

	const selectPrevious = useCallback(() => {
		if (results.length === 0) return;
		setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
	}, [results.length]);

	const getSelectedResult = useCallback((): WikiLinkResult | null => {
		if (results.length === 0) return null;
		return results[selectedIndex];
	}, [results, selectedIndex]);

	const value: WikiLinkContextValue = useMemo(
		() => ({
			results,
			selectedIndex,
			isActive,
			isLoading,
			query,
			handleTriggerStart,
			handleQueryUpdate,
			handleCancel,
			handleSelect,
			selectNext,
			selectPrevious,
			getSelectedResult,
			actionsWikiLink,
			showActions,
			hideActions,
		}),
		[
			results,
			selectedIndex,
			isActive,
			isLoading,
			query,
			handleTriggerStart,
			handleQueryUpdate,
			handleCancel,
			handleSelect,
			selectNext,
			selectPrevious,
			getSelectedResult,
			actionsWikiLink,
			showActions,
			hideActions,
		],
	);

	return (
		<WikiLinkContext.Provider value={value}>
			{children}
		</WikiLinkContext.Provider>
	);
}

export function useWikiLinkContext(): WikiLinkContextValue {
	const ctx = useContext(WikiLinkContext);
	if (!ctx) {
		throw new Error("useWikiLinkContext must be used within WikiLinkProvider");
	}
	return ctx;
}
