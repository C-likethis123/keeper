import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	Modal,
	type NativeSyntheticEvent,
	Pressable,
	StyleSheet,
	TextInput,
	type TextInputKeyPressEventData,
	View,
} from "react-native";
import { SlashCommandOverlay } from "./SlashCommandOverlay";
import { useSlashCommandContext } from "./SlashCommandContext";

export function SlashCommandModal() {
	const theme = useExtendedTheme();
	const inputRef = useRef<TextInput>(null);
	const slashCommands = useSlashCommandContext();
	const [inputValue, setInputValue] = useState("");

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
			<View style={styles.backdrop}>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={slashCommands.handleCancel}
				/>
				<View style={[styles.card, { backgroundColor: theme.colors.card }]}>
					<TextInput
						ref={inputRef}
						style={[
							styles.input,
							{
								borderColor: theme.colors.border,
								color: theme.colors.text,
							},
						]}
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

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.4)",
		justifyContent: "center",
		alignItems: "center",
		padding: 24,
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
	},
	input: {
		height: 44,
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 12,
		fontSize: 16,
		marginBottom: 8,
	},
});
