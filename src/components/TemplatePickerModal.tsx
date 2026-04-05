import type { ExtendedTheme } from "@/constants/themes/types";
import useSuspenseTemplates from "@/hooks/useSuspenseTemplates";
import { useStyles } from "@/hooks/useStyles";
import { NoteService } from "@/services/notes/noteService";
import type { Note } from "@/services/notes/types";
import { useEditorState } from "@/stores/editorStore";
import { useToastStore } from "@/stores/toastStore";
import { FontAwesome } from "@expo/vector-icons";
import React, { Suspense, useCallback } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import Loader from "./shared/Loader";
import QueryErrorBoundary from "./shared/QueryErrorBoundary";

export default function TemplatePickerModal({
	visible,
	onDismiss,
}: {
	visible: boolean;
	onDismiss: () => void;
}) {
	const styles = useStyles(createStyles);

	if (!visible) return null;

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
						<Pressable onPress={onDismiss}>
							<FontAwesome name="close" size={22} style={styles.closeIcon} />
						</Pressable>
					</View>
					<Suspense fallback={<Loader />}>
						<QueryErrorBoundary
							fallbackRender={(error, reset) => (
								<View>
									<Text style={styles.emptyTemplatesText}>
										Failed to load templates.
									</Text>
									<Pressable onPress={reset}>
										<Text style={styles.emptyTemplatesText}>Retry</Text>
									</Pressable>
								</View>
							)}
						>
							<TemplatePickerContent onDismiss={onDismiss} styles={styles} />
						</QueryErrorBoundary>
					</Suspense>
				</View>
			</View>
		</Modal>
	);
}

function TemplatePickerContent({
	onDismiss,
	styles,
}: {
	onDismiss: () => void;
	styles: ReturnType<typeof createStyles>;
}) {
	const templates = useSuspenseTemplates();
	const showToast = useToastStore((s) => s.showToast);
	const loadMarkdown = useEditorState((s) => s.loadMarkdown);

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

	if (templates.length === 0) {
		return (
			<Text style={styles.emptyTemplatesText}>
				No templates yet. Change a note type to Template to create one.
			</Text>
		);
	}

	return (
		<ScrollView contentContainerStyle={styles.templateList}>
			{templates.map((template) => (
				<Pressable
					key={template.id}
					style={({ pressed }) => [
						styles.templateCard,
						pressed && styles.templateCardPressed,
					]}
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
				</Pressable>
			))}
		</ScrollView>
	);
}

function createStyles(theme: ExtendedTheme) {
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
		closeIcon: {
			color: theme.colors.text,
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
		templateCardPressed: {
			opacity: 0.8,
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
