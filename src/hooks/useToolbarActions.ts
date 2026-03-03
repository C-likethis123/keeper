import {
	BlockType,
	createImageBlock,
	getListLevel,
	isListItem,
} from "@/components/editor/core/BlockNode";
import { copyPickedImageToNotes } from "@/services/notes/imageStorage";
import { useEditorState } from "@/stores/editorStore";
import * as DocumentPicker from "expo-document-picker";
import { useCallback } from "react";
import { Platform } from "react-native";
import { useFocusBlock } from "./useFocusBlock";

export interface UseToolbarActions {
	handleOutdent: () => void;
	handleIndent: () => void;
	handleConvertToCheckbox: () => void;
	handleInsertImage: () => Promise<void>;
}

export function useToolbarActions(): UseToolbarActions {
	const getFocusedBlockIndex = useEditorState((s) => s.getFocusedBlockIndex);
	const updateBlockListLevel = useEditorState((s) => s.updateBlockListLevel);
	const updateBlockType = useEditorState((s) => s.updateBlockType);
	const document = useEditorState((s) => s.document);
	const insertBlockAfter = useEditorState((s) => s.insertBlockAfter);
	const { focusBlock } = useFocusBlock();

	const handleIndent = useCallback(() => {
		const index = getFocusedBlockIndex();
		if (index === null) return;
		const block = document.blocks[index];
		if (isListItem(block.type)) {
			updateBlockListLevel(index, getListLevel(block) + 1);
		}
	}, [document, getFocusedBlockIndex, updateBlockListLevel]);

	const handleOutdent = useCallback(() => {
		const index = getFocusedBlockIndex();
		if (index === null) return;
		const block = document.blocks[index];
		const isListBlock = isListItem(block.type);
		if (!isListBlock) return;
		if (getListLevel(block) > 0) {
			updateBlockListLevel(index, getListLevel(block) - 1);
		} else {
			updateBlockType(index, BlockType.paragraph);
			focusBlock(index);
		}
	}, [
		document,
		getFocusedBlockIndex,
		updateBlockListLevel,
		updateBlockType,
		focusBlock,
	]);

	const handleConvertToCheckbox = useCallback(() => {
		const index = getFocusedBlockIndex();
		if (index === null) return;
		const block = document.blocks[index];
		if (block.type === BlockType.checkboxList) return;
		updateBlockType(index, BlockType.checkboxList);
		focusBlock(index);
	}, [document, getFocusedBlockIndex, updateBlockType, focusBlock]);

	const handleInsertImage = useCallback(async () => {
		if (Platform.OS === "web") return;
		const result = await DocumentPicker.getDocumentAsync({
			type: "image/*",
			copyToCacheDirectory: true,
		});
		if (result.canceled) return;
		const uri = result.assets[0].uri;
		const path = await copyPickedImageToNotes(uri);
		const focusedIndex = getFocusedBlockIndex() ?? 0;
		insertBlockAfter(focusedIndex, createImageBlock(path));
		focusBlock(focusedIndex + 1);
	}, [getFocusedBlockIndex, insertBlockAfter, focusBlock]);

	return {
		handleOutdent,
		handleIndent,
		handleConvertToCheckbox,
		handleInsertImage,
	};
}
