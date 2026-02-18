import {
	BlockType,
	createImageBlock,
	getListLevel,
	isListItem,
} from "@/components/editor/core/BlockNode";
import { useEditorState } from "@/contexts/EditorContext";
import { copyPickedImageToNotes } from "@/services/notes/imageStorage";
import * as DocumentPicker from "expo-document-picker";
import { useCallback } from "react";
import { Platform } from "react-native";
import { useFocusBlock } from "./useFocusBlock";

export interface UseToolbarActions {
	focusBlockIndex: number | null;
	handleOutdent: () => void;
	handleIndent: () => void;
	handleConvertToCheckbox: () => void;
	handleInsertImage: () => Promise<void>;
}

export function useToolbarActions(): UseToolbarActions {
	const editorState = useEditorState();
	const { focusBlock } = useFocusBlock();

	const handleIndent = useCallback(
		() => {
			const index = editorState.getFocusedBlockIndex();
			if (index === null) return;
			const block = editorState.document.blocks[index];
			if (isListItem(block.type)) {
				editorState.updateBlockListLevel(index, getListLevel(block) + 1);
			}
		},
		[editorState],
	);

	const handleOutdent = useCallback(
		() => {
			const index = editorState.getFocusedBlockIndex();
			if (index === null) return;
			const block = editorState.document.blocks[index];
			const isListBlock = isListItem(block.type);
			if (!isListBlock) return;
			if (getListLevel(block) > 0) {
				editorState.updateBlockListLevel(index, getListLevel(block) - 1);
			} else {
				editorState.updateBlockType(index, BlockType.paragraph);
				focusBlock(index);
			}
		},
		[editorState, focusBlock],
	);

	const handleConvertToCheckbox = useCallback(() => {
		const index = editorState.getFocusedBlockIndex();
		if (index === null) return;
		const block = editorState.document.blocks[index];
		if (block.type === BlockType.checkboxList) return;
		editorState.updateBlockType(index, BlockType.checkboxList);
		focusBlock(index);
	}, [editorState, focusBlock]);

	const handleInsertImage = useCallback(async () => {
		if (Platform.OS === "web") return;
		const result = await DocumentPicker.getDocumentAsync({
			type: "image/*",
			copyToCacheDirectory: true,
		});
		if (result.canceled) return;
		const uri = result.assets[0].uri;
		const path = await copyPickedImageToNotes(uri);
		const focusedIndex = editorState.getFocusedBlockIndex() ?? 0;
		editorState.insertBlockAfter(focusedIndex, createImageBlock(path));
		focusBlock(focusedIndex + 1);
	}, [editorState, focusBlock]);


	const focusBlockIndex = editorState.getFocusedBlockIndex();
	return {
		focusBlockIndex,
		handleOutdent,
		handleIndent,
		handleConvertToCheckbox,
		handleInsertImage,
	};
}
