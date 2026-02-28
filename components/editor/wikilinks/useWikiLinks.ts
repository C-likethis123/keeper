import { PAGE_SIZE } from "@/constants/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { useEditorDocument } from "@/stores/editorStore";
import { useCallback, useEffect, useState } from "react";
import { findWikiLinkTriggerStart } from "./WikiLinkTrigger";

interface UseWikiLinksReturn {
	// State
	query: string;
	results: string[];
	selectedIndex: number;
	isActive: boolean;
	isLoading: boolean;

	// Handlers
	handleTriggerStart: () => void;
	handleQueryUpdate: (query: string) => void;
	handleTriggerEnd: () => void;
	handleSelect: (
		link: string,
		blockIndex: number,
		cursorOffset: number,
		onUpdateContent: (index: number, content: string) => void,
	) => void;

	// Navigation
	selectNext: () => void;
	selectPrevious: () => void;
	getSelectedResult: () => string | null;
}

/// Custom hook for managing wiki link autocomplete state
/// Replaces the WikiLinkController class with React state management
export function useWikiLinks(): UseWikiLinksReturn {
	const [isActive, setIsActive] = useState<boolean>(false);
	const [query, setQuery] = useState<string>("");
	const debouncedQuery = useDebounce(query, 300);
	const [results, setResults] = useState<string[]>([]);
	const [selectedIndex, setSelectedIndex] = useState<number>(0);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const document = useEditorDocument();

	/// End the wiki link session
	const handleTriggerEnd = useCallback(() => {
		setIsActive(false);
		setQuery("");
		setResults([]);
		setSelectedIndex(0);
		setIsLoading(false);
	}, []);

	/// Start a new wiki link session
	const handleTriggerStart = useCallback(() => {
		if (isActive) {
			return;
		}
		setIsActive(true);
		setQuery("");
		setResults([]);
		setSelectedIndex(0);
		setIsLoading(false);
	}, [isActive]);

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

	/// Update the query and search for results
	const handleQueryUpdate = setQuery;

	/// Cancel the wiki link session (same as end)
	const cancel = useCallback(() => {
		handleTriggerEnd();
	}, [handleTriggerEnd]);

	/// Select a wiki link and insert it into the block
	const handleSelect = useCallback(
		(
			link: string,
			blockIndex: number,
			cursorOffset: number,
			onUpdateContent: (index: number, content: string) => void,
		) => {
			if (!isActive) {
				return;
			}

			const block = document.blocks[blockIndex];
			if (!block) return;

			const text = block.content;
			// from where the cursor starts, find the nearest start
			const start = findWikiLinkTriggerStart(text, cursorOffset);
			if (start === null) {
				return;
			}
			const end = start + 2 + query.length; // [[ + query

			const newText = `${text.substring(0, start)}[[${link}]]${text.substring(end)}`;

			onUpdateContent(blockIndex, newText);
			handleTriggerEnd();
		},
		[query, document, handleTriggerEnd, isActive],
	);

	/// Navigate to next result
	const selectNext = useCallback(() => {
		if (results.length === 0) return;
		setSelectedIndex((prev) => (prev + 1) % results.length);
	}, [results.length]);

	/// Navigate to previous result
	const selectPrevious = useCallback(() => {
		if (results.length === 0) return;
		setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
	}, [results.length]);

	/// Get the currently selected result
	const getSelectedResult = useCallback((): string | null => {
		if (results.length === 0) return null;
		return results[selectedIndex];
	}, [results, selectedIndex]);

	return {
		// State
		query,
		results,
		selectedIndex,
		isActive,
		isLoading,

		// Handlers
		handleTriggerStart,
		handleQueryUpdate,
		handleTriggerEnd,
		handleSelect,

		// Navigation
		selectNext,
		selectPrevious,
		getSelectedResult,
	};
}
