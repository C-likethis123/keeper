import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { notesIndexDbListAll } from "@/services/notes/notesIndexDb";
import { useCallback, useEffect, useState } from "react";
import {
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

type AddNoteToClusterModalProps = {
	visible: boolean;
	onClose: () => void;
	onConfirm: (noteId: string, noteTitle: string) => void;
	excludeNoteIds: string[];
};

type NoteResult = { id: string; title: string };

export default function AddNoteToClusterModal({
	visible,
	onClose,
	onConfirm,
	excludeNoteIds,
}: AddNoteToClusterModalProps) {
	const styles = useStyles(createStyles);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<NoteResult[]>([]);

	const search = useCallback(
		async (q: string) => {
			const { items } = await notesIndexDbListAll(q, 20);
			setResults(
				items
					.filter((n) => !excludeNoteIds.includes(n.noteId))
					.map((n) => ({ id: n.noteId, title: n.title })),
			);
		},
		[excludeNoteIds],
	);

	useEffect(() => {
		if (visible) {
			setQuery("");
			void search("");
		}
	}, [visible, search]);

	useEffect(() => {
		void search(query);
	}, [query, search]);

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onClose}
		>
			<View style={styles.backdrop}>
				<View style={styles.card}>
					<Text style={styles.title}>Add Note to Cluster</Text>
					<TextInput
						style={styles.input}
						value={query}
						onChangeText={setQuery}
						placeholder="Search notes…"
						placeholderTextColor={styles.placeholder.color}
						autoFocus
					/>
					<FlatList
						data={results}
						keyExtractor={(item) => item.id}
						style={styles.list}
						keyboardShouldPersistTaps="handled"
						renderItem={({ item }) => (
							<Pressable
								style={styles.row}
								onPress={() => onConfirm(item.id, item.title)}
							>
								<Text style={styles.rowText} numberOfLines={1}>
									{item.title || item.id}
								</Text>
							</Pressable>
						)}
						ListEmptyComponent={
							<Text style={styles.empty}>No notes found</Text>
						}
					/>
					<Pressable style={styles.cancelButton} onPress={onClose}>
						<Text style={styles.cancelText}>Cancel</Text>
					</Pressable>
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
			justifyContent: "flex-end",
		},
		card: {
			backgroundColor: theme.colors.background,
			borderTopLeftRadius: 16,
			borderTopRightRadius: 16,
			padding: 20,
			maxHeight: "70%",
			gap: 12,
		},
		title: {
			fontSize: 17,
			fontWeight: "700",
			color: theme.colors.text,
		},
		input: {
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			paddingHorizontal: 12,
			paddingVertical: 10,
			fontSize: 15,
			color: theme.colors.text,
			backgroundColor: theme.colors.card,
		},
		placeholder: { color: theme.colors.textSecondary },
		list: { flexGrow: 0, maxHeight: 300 },
		row: {
			paddingVertical: 12,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		rowText: { fontSize: 15, color: theme.colors.text },
		empty: {
			fontSize: 14,
			color: theme.colors.textSecondary,
			textAlign: "center",
			paddingVertical: 20,
		},
		cancelButton: {
			alignItems: "center",
			paddingVertical: 12,
			borderRadius: 10,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
		},
		cancelText: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
		},
	});
}
