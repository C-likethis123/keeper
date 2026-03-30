import { useEditorState } from "@/stores/editorStore";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	BlockType,
	createCollapsibleBlock,
	createParagraphBlock,
} from "../core/BlockNode";

export interface SlashCommandItem {
	id: "insert-template" | "insert-collapsible";
	title: string;
	description: string;
	keywords: string[];
}

interface SlashCommandContextValue {
	results: SlashCommandItem[];
	selectedIndex: number;
	isActive: boolean;
	isLoading: boolean;
	query: string;

	handleTriggerStart: (
		blockIndex: number,
		triggerStartOffset: number,
		initialQuery: string,
	) => void;
	handleQueryUpdate: (query: string) => void;
	handleCancel: () => void;
	handleSelect: (item: SlashCommandItem) => void;

	selectNext: () => void;
	selectPrevious: () => void;
	getSelectedResult: () => SlashCommandItem | null;
}

const SlashCommandContext = createContext<SlashCommandContextValue | null>(null);

const COMMANDS: SlashCommandItem[] = [
	{
		id: "insert-template",
		title: "Insert template",
		description: "Open the template picker and replace the note body.",
		keywords: ["template", "insert", "snippet"],
	},
	{
		id: "insert-collapsible",
		title: "Collapsible section",
		description: "Insert a collapsible section block.",
		keywords: ["collapsible", "details", "summary", "section", "toggle", "fold"],
	},
];

export function SlashCommandProvider({
	children,
	onInsertTemplateCommand,
}: {
	children: React.ReactNode;
	onInsertTemplateCommand?: () => void | Promise<void>;
}) {
	const [isActive, setIsActive] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const blockIndexRef = useRef(0);
	const triggerStartOffsetRef = useRef(0);
	const updateBlockContent = useEditorState((s) => s.updateBlockContent);

	const results = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (normalizedQuery.length === 0) {
			return COMMANDS;
		}

		return COMMANDS.filter((item) => {
			const haystacks = [item.title, item.description, ...item.keywords];
			return haystacks.some((value) =>
				value.toLowerCase().includes(normalizedQuery),
			);
		});
	}, [query]);

	const endSession = useCallback(() => {
		setIsActive(false);
		setQuery("");
		setSelectedIndex(0);
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

	const handleTriggerStart = useCallback(
		(
			blockIndex: number,
			triggerStartOffset: number,
			initialQuery: string,
		) => {
			blockIndexRef.current = blockIndex;
			triggerStartOffsetRef.current = triggerStartOffset;
			const doc = useEditorState.getState().document;
			const block = doc.blocks[blockIndex];
			if (block) {
				const trimmed = `${block.content.substring(0, triggerStartOffset)}/`;
				if (block.content !== trimmed) {
					updateBlockContent(blockIndex, trimmed);
				}
			}
			setIsActive(true);
			setQuery(initialQuery);
			setSelectedIndex(0);
		},
		[updateBlockContent],
	);

	const removeTriggerToken = useCallback(() => {
		const doc = useEditorState.getState().document;
		const block = doc.blocks[blockIndexRef.current];
		if (!block) return;
		const start = triggerStartOffsetRef.current;
		if (block.content[start] !== "/") {
			return;
		}
		const newText = `${block.content.substring(0, start)}${block.content.substring(start + 1)}`;
		updateBlockContent(blockIndexRef.current, newText, start);
	}, [updateBlockContent]);

	const handleCancel = useCallback(() => {
		if (!isActive) return;
		removeTriggerToken();
		endSession();
	}, [endSession, isActive, removeTriggerToken]);

	const handleSelect = useCallback(
		async (item: SlashCommandItem) => {
			if (!isActive) return;
			removeTriggerToken();
			endSession();
			if (item.id === "insert-template") {
				await onInsertTemplateCommand?.();
			} else if (item.id === "insert-collapsible") {
				const blockIndex = blockIndexRef.current;
				const state = useEditorState.getState();
				const block = state.document.blocks[blockIndex];
				if (block) {
					state.updateBlockType(blockIndex, BlockType.collapsibleBlock);
					state.updateBlockAttributes(blockIndex, {
						summary: "",
						isExpanded: true,
					});
					state.insertBlockAfter(blockIndex, createParagraphBlock());
				}
			}
		},
		[isActive, onInsertTemplateCommand, endSession, removeTriggerToken],
	);

	const selectNext = useCallback(() => {
		if (results.length === 0) return;
		setSelectedIndex((prev) => (prev + 1) % results.length);
	}, [results.length]);

	const selectPrevious = useCallback(() => {
		if (results.length === 0) return;
		setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
	}, [results.length]);

	const getSelectedResult = useCallback(() => {
		if (results.length === 0) return null;
		return results[selectedIndex] ?? null;
	}, [results, selectedIndex]);

	const value = useMemo(
		() => ({
			results,
			selectedIndex,
			isActive,
			isLoading: false,
			query,
			handleTriggerStart,
			handleQueryUpdate: setQuery,
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
			query,
			handleTriggerStart,
			handleCancel,
			handleSelect,
			selectNext,
			selectPrevious,
			getSelectedResult,
		],
	);

	return (
		<SlashCommandContext.Provider value={value}>
			{children}
		</SlashCommandContext.Provider>
	);
}

export function useSlashCommandContext(): SlashCommandContextValue {
	const ctx = useContext(SlashCommandContext);
	if (!ctx) {
		throw new Error(
			"useSlashCommandContext must be used within a SlashCommandProvider",
		);
	}
	return ctx;
}
