import { webTextInputReset } from "@/components/shared/textInputWebStyles";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Modal,
	type NativeSyntheticEvent,
	Pressable,
	StyleSheet,
	TextInput,
	type TextInputKeyPressEventData,
	View,
} from "react-native";
import { useSlashCommandContext } from "./SlashCommandContext";
import { SlashCommandOverlay } from "./SlashCommandOverlay";

interface EdgeInsets {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export function SlashCommandModal({
	safeAreaInsets,
	keyboardHeight = 0,
}: {
	safeAreaInsets?: EdgeInsets;
	keyboardHeight?: number;
}) {
	const theme = useExtendedTheme();
	const styles = createStyles(theme);
	const inputRef = useRef<TextInput>(null);
	const slashCommands = useSlashCommandContext();
	const [inputValue, setInputValue] = useState("");
	const backdropStyle = useMemo(
		() => [
			styles.backdrop,
			{
				paddingTop: (safeAreaInsets?.top ?? 0) + 24,
				paddingRight: (safeAreaInsets?.right ?? 0) + 24,
				paddingBottom: (safeAreaInsets?.bottom ?? 0) + keyboardHeight + 24,
				paddingLeft: (safeAreaInsets?.left ?? 0) + 24,
			},
		],
		[styles.backdrop, safeAreaInsets, keyboardHeight],
	);

	useEffect(() => {
		if (slashCommands.isActive) {
			setInputValue(slashCommands.query);
		}
	}, [slashCommands.isActive, slashCommands.query]);

	const handleKeyPress = useCallback(
		(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
			const key = e.nativeEvent.key;
			if (key === "Backspace" && inputValue === "") {
				slashCommands.handleCancel();
				return;
			}
			if (key === "ArrowDown") {
				slashCommands.selectNext();
				return;
			}
			if (key === "ArrowUp") {
				slashCommands.selectPrevious();
				return;
			}
			if (key === "Escape") {
				slashCommands.handleCancel();
			}
		},
		[
			inputValue,
			slashCommands.handleCancel,
			slashCommands.selectNext,
			slashCommands.selectPrevious,
		],
	);

	const handleSubmitEditing = useCallback(() => {
		const selected = slashCommands.getSelectedResult();
		if (selected) {
			void slashCommands.handleSelect(selected);
		}
	}, [slashCommands.getSelectedResult, slashCommands.handleSelect]);

	return (
		<Modal
			visible={slashCommands.isActive}
			transparent
			animationType="fade"
			onRequestClose={slashCommands.handleCancel}
			onShow={() => {
				inputRef.current?.focus();
			}}
		>
			<View style={backdropStyle}>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={slashCommands.handleCancel}
				/>
				<View style={styles.card}>
					<TextInput
						ref={inputRef}
						style={styles.input}
						value={inputValue}
						onChangeText={(text) => {
							setInputValue(text);
							slashCommands.handleQueryUpdate(text);
						}}
						onKeyPress={handleKeyPress}
						onSubmitEditing={handleSubmitEditing}
						placeholder="Type a command..."
						placeholderTextColor={theme.custom.editor.placeholder}
						autoFocus
						autoCapitalize="none"
						autoCorrect={false}
					/>
					<SlashCommandOverlay
						results={slashCommands.results}
						selectedIndex={slashCommands.selectedIndex}
						isLoading={slashCommands.isLoading}
						onSelect={(item) => {
							void slashCommands.handleSelect(item);
						}}
					/>
				</View>
			</View>
		</Modal>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		backdrop: {
			flex: 1,
			backgroundColor: "rgba(0,0,0,0.4)",
			justifyContent: "center",
			alignItems: "center",
		},
		card: {
			width: "100%",
			maxWidth: 420,
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
			borderColor: theme.colors.border,
			color: theme.colors.text,
			...webTextInputReset,
		},
	});
}
