import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import React, { useCallback, useRef, useState } from "react";
import {
	Modal,
	type NativeSyntheticEvent,
	Pressable,
	StyleSheet,
	TextInput,
	type TextInputKeyPressEventData,
	View,
} from "react-native";
import { useWikiLinkContext } from "./WikiLinkContext";
import { WikiLinkOverlay } from "./WikiLinkOverlay";

export function WikiLinkModal() {
	const theme = useExtendedTheme();
	const inputRef = useRef<TextInput>(null);
	const wikiLinks = useWikiLinkContext();
	const styles = useStyles(createStyles);
	const [inputValue, setInputValue] = useState("");
	const handleKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;
			if (key === "Backspace" && inputValue === "") {
				wikiLinks.handleCancel();
				return;
			}
			if (key === "ArrowDown") {
				wikiLinks.selectNext();
				return;
			}
			if (key === "ArrowUp") {
				wikiLinks.selectPrevious();
				return;
			}
			if (key === "Escape") {
				wikiLinks.handleCancel();
			}
		},
		[inputValue, wikiLinks.handleCancel, wikiLinks.selectNext, wikiLinks.selectPrevious],
	);

	const handleSubmitEditing = useCallback(() => {
		const selected = wikiLinks.getSelectedResult();
		if (selected) wikiLinks.handleSelect(selected);
	}, [wikiLinks.getSelectedResult, wikiLinks.handleSelect]);

	return (
		<Modal
			visible={wikiLinks.isActive}
			transparent
			animationType="fade"
			onRequestClose={wikiLinks.handleCancel}
			onShow={() => {
				setInputValue("");
				inputRef.current?.focus();
			}}
		>
			<View style={styles.backdrop}>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={wikiLinks.handleCancel}
				/>
				<View style={styles.card}>
					<TextInput
						style={styles.input}
						onSubmitEditing={handleSubmitEditing}
						placeholder="Search notes..."
						placeholderTextColor={theme.custom.editor.placeholder}
						onChangeText={(text) => {
						setInputValue(text);
						wikiLinks.handleQueryUpdate(text);
					}}
						onKeyPress={handleKeyPress}
						autoFocus
						autoCapitalize="none"
						autoCorrect={false}
						ref={inputRef}
					/>
					<WikiLinkOverlay
						results={wikiLinks.results}
						selectedIndex={wikiLinks.selectedIndex}
						isLoading={wikiLinks.isLoading}
						onSelect={wikiLinks.handleSelect}
					/>
				</View>
			</View>
		</Modal>
	);
}
function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		backdrop: {
			flex: 1,
			backgroundColor: "rgba(0,0,0,0.4)",
			justifyContent: "center",
			alignItems: "center",
			padding: 24,
		},
		card: {
			width: "100%",
			maxWidth: 400,
			borderRadius: 12,
			padding: 12,
			shadowColor: "#000",
			shadowOffset: { width: 0, height: 4 },
			shadowOpacity: 0.2,
			shadowRadius: 12,
			elevation: 12,
			backgroundColor: theme.colors.card,
		},
		input: {
			height: 44,
			borderWidth: 1,
			borderRadius: 8,
			paddingHorizontal: 12,
			fontSize: 16,
			marginBottom: 8,
			color: theme.colors.text,
			borderColor: theme.colors.border,
		},
	});
}
