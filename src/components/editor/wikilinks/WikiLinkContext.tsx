import { PAGE_SIZE } from "@/constants/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { useEditorState } from "@/stores/editorStore";
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

export interface WikiLinkContextValue {
	results: string[];
	selectedIndex: number;
	isActive: boolean;
	isLoading: boolean;

	handleTriggerStart: (blockIndex: number, triggerStartOffset: number) => void;
	handleQueryUpdate: (query: string) => void;
	handleCancel: () => void;
	handleSelect: (link: string) => void;

	selectNext: () => void;
	selectPrevious: () => void;
	getSelectedResult: () => string | null;
}

const WikiLinkContext = createContext<WikiLinkContextValue | null>(null);

export function WikiLinkProvider({ children }: { children: React.ReactNode }) {
	const [isActive, setIsActive] = useState<boolean>(false);
	const [query, setQuery] = useState<string>("");
	const debouncedQuery = useDebounce(query, 300);
	const [results, setResults] = useState<string[]>([]);
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
				const titles: string[] = [];
				const seenTitles = new Set<string>();

				for (const item of result.items) {
					if (item.title && !seenTitles.has(item.title)) {
						seenTitles.add(item.title);
						titles.push(item.title);
					}
				}

				setResults(titles);
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
		(link: string) => {
			if (!isActive) return;

			const doc = useEditorState.getState().document;
			const block = doc.blocks[blockIndexRef.current];
			if (!block) return;

			const start = triggerStartOffsetRef.current;
			const newText = `${block.content.substring(0, start)}[[${link}]]${block.content.substring(start + 2)}`;

			updateBlockContent(blockIndexRef.current, newText);
			endSession();
		},
		[isActive, endSession, updateBlockContent],
	);

	const selectNext = useCallback(() => {
		if (results.length === 0) return;
		setSelectedIndex((prev) => (prev + 1) % results.length);
	}, [results.length]);

	const selectPrevious = useCallback(() => {
		if (results.length === 0) return;
		setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
	}, [results.length]);

	const getSelectedResult = useCallback((): string | null => {
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
