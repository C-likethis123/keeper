import {
	BlockType,
	createImageBlock,
	createParagraphBlock,
} from "@/components/editor/core/BlockNode";
import { executeEditorCommand } from "@/components/editor/keyboard/editorCommands";
import { useEditorCommandContext } from "@/components/editor/keyboard/useEditorCommandContext";
import { useEditorState } from "@/stores/editorStore";
import { useCallback } from "react";
import { Platform } from "react-native";
import { useFocusBlock } from "./useFocusBlock";

interface UseToolbarActions {
	handleOutdent: () => void;
	handleIndent: () => void;
	handleConvertToCheckbox: () => void;
	handleInsertImage: () => Promise<void>;
	handleInsertCollapsible: () => void;
}

export function useToolbarActions(): UseToolbarActions {
	const getFocusedBlockIndex = useEditorState((s) => s.getFocusedBlockIndex);
	const updateBlockType = useEditorState((s) => s.updateBlockType);
	const updateBlockAttributes = useEditorState((s) => s.updateBlockAttributes);
	const document = useEditorState((s) => s.document);
	const insertBlockAfter = useEditorState((s) => s.insertBlockAfter);
	const { focusBlock } = useFocusBlock();
	const commandContext = useEditorCommandContext({
		isEditorActive: true,
		isWikiLinkModalOpen: false,
		dismissOverlays: () => false,
	});

	const handleIndent = useCallback(() => {
		executeEditorCommand("indentListItem", commandContext);
	}, [commandContext]);

	const handleOutdent = useCallback(() => {
		executeEditorCommand("outdentListItem", commandContext);
	}, [commandContext]);

	const handleConvertToCheckbox = useCallback(() => {
		const index = getFocusedBlockIndex();
		if (index === null) return;
		const block = document.blocks[index];
		if (block.type === BlockType.checkboxList) return;
		updateBlockType(index, BlockType.checkboxList);
		focusBlock(index);
	}, [document, getFocusedBlockIndex, updateBlockType, focusBlock]);

	const handleInsertImage = useCallback(async () => {
		const focusedIndex = getFocusedBlockIndex() ?? 0;

		if (Platform.OS === "web") {
			// Desktop (Tauri): use native file dialog
			const [dialogModule, imageStorageModule] = await Promise.all([
				import("@tauri-apps/plugin-dialog"),
				import("@/services/notes/imageStorage.web"),
			]);
			const selected = await dialogModule.open({
				title: "Select Image",
				multiple: false,
				filters: [
					{
						name: "Images",
						extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"],
					},
				],
			});
			if (selected === null || Array.isArray(selected)) return;
			const path = await imageStorageModule.copyPickedImageToNotes(selected);
			insertBlockAfter(focusedIndex, createImageBlock(path));
			focusBlock(focusedIndex + 1);
			return;
		}

		// Mobile: use expo-document-picker
		const [documentPickerModule, imageStorageModule] = await Promise.all([
			import("expo-document-picker"),
			import("@/services/notes/imageStorage"),
		]);
		const result = await documentPickerModule.getDocumentAsync({
			type: "image/*",
			copyToCacheDirectory: true,
		});
		if (result.canceled) return;
		const uri = result.assets[0].uri;
		const path = await imageStorageModule.copyPickedImageToNotes(uri);
		insertBlockAfter(focusedIndex, createImageBlock(path));
		focusBlock(focusedIndex + 1);
	}, [getFocusedBlockIndex, insertBlockAfter, focusBlock]);

	const handleInsertCollapsible = useCallback(() => {
		const index = getFocusedBlockIndex() ?? 0;
		updateBlockType(index, BlockType.collapsibleBlock);
		updateBlockAttributes(index, { summary: "", isExpanded: true });
		insertBlockAfter(index, createParagraphBlock());
		focusBlock(index + 1);
	}, [
		getFocusedBlockIndex,
		updateBlockType,
		updateBlockAttributes,
		insertBlockAfter,
		focusBlock,
	]);

	return {
		handleOutdent,
		handleIndent,
		handleConvertToCheckbox,
		handleInsertImage,
		handleInsertCollapsible,
	};
}
