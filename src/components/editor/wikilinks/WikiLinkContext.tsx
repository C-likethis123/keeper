import { PAGE_SIZE } from "@/constants/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { NoteService } from "@/services/notes/noteService";
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
import { normalizeWikiLinkTitle } from "./wikiLinkUtils";

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

	handleTriggerStart: (blockIndex: number, triggerStartOffset: number) => void;
	handleQueryUpdate: (query: string) => void;
	handleCancel: () => void;
	handleSelect: (result: WikiLinkResult) => void;

	selectNext: () => void;
	selectPrevious: () => void;
	getSelectedResult: () => WikiLinkResult | null;
}

const WikiLinkContext = createContext<WikiLinkContextValue | null>(null);

export function WikiLinkProvider({ children }: { children: React.ReactNode }) {
	const [isActive, setIsActive] = useState<boolean>(false);
	const [query, setQuery] = useState<string>("");
	const debouncedQuery = useDebounce(query, 300);
	const [results, setResults] = useState<WikiLinkResult[]>([]);
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const blockIndexRef = useRef<number>(0);
	const triggerStartOffsetRef = useRef<number>(0);

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

	const handleTriggerStart = useCallback(
		(blockIndex: number, triggerStartOffset: number) => {
			if (isActive) return;
			blockIndexRef.current = blockIndex;
			triggerStartOffsetRef.current = triggerStartOffset;
			const doc = useEditorState.getState().document;
			const block = doc.blocks[blockIndex];
			if (block && block.content.length > triggerStartOffset + 2) {
				const trimmed = block.content.substring(0, triggerStartOffset + 2);
				updateBlockContent(blockIndex, trimmed);
			}
			setIsActive(true);
			setQuery("");
			setResults([]);
			setSelectedIndex(0);
			setIsLoading(false);
		},
		[isActive, updateBlockContent],
	);

	const handleCancel = useCallback(() => {
		if (!isActive) return;
		const doc = useEditorState.getState().document;
		const block = doc.blocks[blockIndexRef.current];
		if (block) {
			const start = triggerStartOffsetRef.current;
			const newText = `${block.content.substring(0, start)}${block.content.substring(start + 2)}`;
			updateBlockContent(blockIndexRef.current, newText);
		}
		endSession();
	}, [isActive, endSession, updateBlockContent]);

	const insertWikiLink = useCallback(
		(title: string) => {
			const doc = useEditorState.getState().document;
			const block = doc.blocks[blockIndexRef.current];
			if (!block) return;

			const start = triggerStartOffsetRef.current;
			const newText = `${block.content.substring(0, start)}[[${title}]]${block.content.substring(start + 2)}`;
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
				const normalizedQuery = normalizeWikiLinkTitle(debouncedQuery);
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
					nextResults.unshift({
						id: `create:${normalizedQuery}`,
						type: "create",
						title: debouncedQuery.trim(),
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
	}, [debouncedQuery, isActive]);

	const handleQueryUpdate = setQuery;

	const handleSelect = useCallback(
		async (result: WikiLinkResult) => {
			if (!isActive) return;
			insertWikiLink(result.title);
			if (result.type === "create") {
				try {
					await NoteService.saveNote(
						{
							id: nanoid(),
							title: result.title,
							content: "",
							lastUpdated: Date.now(),
							isPinned: false,
							noteType: "note",
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
			handleTriggerStart,
			handleQueryUpdate,
			handleCancel,
			handleSelect,
			selectNext,
			selectPrevious,
			getSelectedResult,
		}),
		[
			results,
			selectedIndex,
			isActive,
			isLoading,
			handleTriggerStart,
			handleQueryUpdate,
			handleCancel,
			handleSelect,
			selectNext,
			selectPrevious,
			getSelectedResult,
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
