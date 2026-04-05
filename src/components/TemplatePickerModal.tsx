import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { NoteService } from "@/services/notes/noteService";
import { NotesIndexService } from "@/services/notes/notesIndex";
import type { Note } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { useToastStore } from "@/stores/toastStore";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import Loader from "./shared/Loader";

export default function TemplatePickerModal({
	visible,
	onDismiss,
}: {
	visible: boolean;
	onDismiss: () => void;
}) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);
	const [templates, setTemplates] = useState<Note[]>([]);
	const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
	const showToast = useToastStore((s) => s.showToast);
	const loadMarkdown = useEditorState((s) => s.loadMarkdown);

	useEffect(() => {
		if (!visible) return;

		let cancelled = false;
		setIsLoadingTemplates(true);
		NotesIndexService.listNotes("", 100, 0, { noteTypes: ["template"] })
			.then((result) => {
				if (cancelled) return;
				const notes: Note[] = result.items.map((item) => ({
					id: item.noteId,
					title: item.title,
					content: item.summary ?? "",
					lastUpdated: item.updatedAt,
					isPinned: item.isPinned,
					noteType: item.noteType,
					status: item.status,
				}));
				setTemplates(notes);
			})
			.catch((error) => {
				if (cancelled) return;
				console.warn("Failed to load templates:", error);
				showToast("Failed to load templates");
			})
			.finally(() => {
				if (!cancelled) setIsLoadingTemplates(false);
			});

		return () => {
			cancelled = true;
		};
	}, [visible, showToast]);

	const applyTemplate = useCallback(
		async (template: Note) => {
			try {
				const fullTemplate = await NoteService.loadNote(template.id);
				if (!fullTemplate) {
					showToast("Template not found");
					return;
				}
				loadMarkdown(fullTemplate.content);
				onDismiss();
				showToast(`Applied template "${fullTemplate.title || "Untitled"}"`);
			} catch (error) {
				console.warn("Failed to apply template:", error);
				showToast("Failed to apply template");
			}
		},
		[loadMarkdown, onDismiss, showToast],
	);

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onDismiss}
		>
			<View style={styles.modalBackdrop}>
				<View style={styles.modalCard}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Choose template</Text>
						<TouchableOpacity onPress={onDismiss}>
							<MaterialIcons name="close" size={22} color={theme.colors.text} />
						</TouchableOpacity>
					</View>
					{isLoadingTemplates ? (
						<Loader />
					) : templates.length === 0 ? (
						<Text style={styles.emptyTemplatesText}>
							No templates yet. Change a note type to Template to create one.
						</Text>
					) : (
						<ScrollView contentContainerStyle={styles.templateList}>
							{templates.map((template) => (
								<TouchableOpacity
									key={template.id}
									style={styles.templateCard}
									onPress={() => {
										void applyTemplate(template);
									}}
								>
									<Text style={styles.templateCardTitle}>
										{template.title || "Untitled template"}
									</Text>
									<Text style={styles.templateCardContent} numberOfLines={4}>
										{template.content || "Empty template"}
									</Text>
								</TouchableOpacity>
							))}
						</ScrollView>
					)}
				</View>
			</View>
		</Modal>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		modalBackdrop: {
			flex: 1,
			backgroundColor: "rgba(0, 0, 0, 0.35)",
			justifyContent: "center",
			padding: 20,
		},
		modalCard: {
			maxHeight: "80%",
			borderRadius: 16,
			padding: 16,
			backgroundColor: theme.colors.background,
			borderWidth: 1,
			borderColor: theme.colors.border,
		},
		modalHeader: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: 12,
		},
		modalTitle: {
			fontSize: 18,
			fontWeight: "700",
			color: theme.colors.text,
		},
		emptyTemplatesText: {
			fontSize: 14,
			lineHeight: 20,
			color: theme.colors.textMuted,
		},
		templateList: {
			gap: 10,
		},
		templateCard: {
			borderRadius: 12,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
			padding: 12,
			gap: 6,
		},
		templateCardTitle: {
			fontSize: 15,
			fontWeight: "600",
			color: theme.colors.text,
		},
		templateCardContent: {
			fontSize: 13,
			lineHeight: 18,
			color: theme.colors.textMuted,
		},
	});
}
