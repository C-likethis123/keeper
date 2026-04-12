import { useState, useRef } from "react";
import type { GitConflictFile } from "@/services/git/engines/GitEngine";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import {
	Alert,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";

type ViewMode = "comparison" | "edit";

interface ConflictComparisonViewProps {
	conflict: GitConflictFile;
	onResolve: (strategy: "ours" | "theirs" | "base" | "manual", manualContent?: string) => void;
}

export default function ConflictComparisonView({
	conflict,
	onResolve,
}: ConflictComparisonViewProps) {
	const styles = useStyles(createStyles);
	const [viewMode, setViewMode] = useState<ViewMode>("comparison");
	const [editedContent, setEditedContent] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const textInputRef = useRef<TextInput>(null);

	// Initialize edited content when entering edit mode
	const handleEnterEditMode = () => {
		// Start with local content as the base for editing
		setEditedContent(conflict.oursContent ?? conflict.theirsContent ?? "");
		setViewMode("edit");
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		Alert.alert(
			"Discard Changes?",
			"Your edits will be lost. Continue anyway?",
			[
				{ text: "Keep Editing", style: "cancel" },
				{
					text: "Discard",
					style: "destructive",
					onPress: () => {
						setViewMode("comparison");
						setIsEditing(false);
					},
				},
			],
		);
	};

	const handleSaveAndResolve = () => {
		if (!editedContent.trim()) {
			Alert.alert(
				"Empty Content",
				"The file will be empty. Are you sure?",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Continue",
						style: "destructive",
						onPress: () => onResolve("manual", editedContent),
					},
				],
			);
		} else {
			onResolve("manual", editedContent);
		}
	};

	const hasContent =
		conflict.baseContent || conflict.oursContent || conflict.theirsContent;

	if (!hasContent) {
		return (
			<View style={styles.emptyContainer}>
				<Text style={styles.emptyText}>No content available for this conflict</Text>
			</View>
		);
	}

	// Comparison mode: side-by-side view
	if (viewMode === "comparison") {
		return (
			<View style={styles.container}>
				{/* View Mode Toggle */}
				<View style={styles.toolbar}>
					<TouchableOpacity
						style={[styles.toolbarButton, styles.toolbarButtonActive]}
						activeOpacity={0.7}
					>
						<Text style={styles.toolbarButtonText}>Compare</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.toolbarButton}
						onPress={handleEnterEditMode}
						activeOpacity={0.7}
					>
						<Text style={styles.toolbarButtonText}>Edit Manually</Text>
					</TouchableOpacity>
				</View>

				{/* Side-by-Side Content */}
				<View style={styles.comparisonContainer}>
					{/* Local Version */}
					{conflict.oursContent && (
						<View style={styles.column}>
							<View style={[styles.columnHeader, { borderLeftColor: "#3b82f6" }]}>
								<Text style={styles.columnHeaderTitle}>Local</Text>
								<Text style={styles.columnHeaderSubtitle}>This Device</Text>
							</View>
							<ScrollView style={styles.columnContent}>
								<Text style={styles.columnText}>{conflict.oursContent}</Text>
							</ScrollView>
						</View>
					)}

					{/* Divider */}
					{conflict.oursContent && conflict.theirsContent && (
						<View style={styles.divider} />
					)}

					{/* Remote Version */}
					{conflict.theirsContent && (
						<View style={styles.column}>
							<View style={[styles.columnHeader, { borderLeftColor: "#10b981" }]}>
								<Text style={styles.columnHeaderTitle}>Remote</Text>
								<Text style={styles.columnHeaderSubtitle}>Server</Text>
							</View>
							<ScrollView style={styles.columnContent}>
								<Text style={styles.columnText}>{conflict.theirsContent}</Text>
							</ScrollView>
						</View>
					)}

					{/* Only one version exists */}
					{!conflict.oursContent && conflict.theirsContent && (
						<View style={styles.column}>
							<View style={[styles.columnHeader, { borderLeftColor: "#10b981" }]}>
								<Text style={styles.columnHeaderTitle}>Remote</Text>
								<Text style={styles.columnHeaderSubtitle}>Server (only version)</Text>
							</View>
							<ScrollView style={styles.columnContent}>
								<Text style={styles.columnText}>{conflict.theirsContent}</Text>
							</ScrollView>
						</View>
					)}
				</View>

				{/* Resolution Actions */}
				<View style={styles.actionsContainer}>
					<Text style={styles.actionsTitle}>Resolve by keeping:</Text>
					<View style={styles.actionButtons}>
						{conflict.oursContent && (
							<TouchableOpacity
								style={[styles.actionButton, { backgroundColor: "#3b82f6" }]}
								onPress={() => onResolve("ours")}
								activeOpacity={0.8}
							>
								<Text style={styles.actionButtonText}>Local Version</Text>
							</TouchableOpacity>
						)}
						{conflict.theirsContent && (
							<TouchableOpacity
								style={[styles.actionButton, { backgroundColor: "#10b981" }]}
								onPress={() => onResolve("theirs")}
								activeOpacity={0.8}
							>
								<Text style={styles.actionButtonText}>Remote Version</Text>
							</TouchableOpacity>
						)}
						<TouchableOpacity
							style={[styles.actionButton, { backgroundColor: "#8b5cf6" }]}
							onPress={handleEnterEditMode}
							activeOpacity={0.8}
						>
							<Text style={styles.actionButtonText}>Edit Manually</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		);
	}

	// Edit mode: full editor
	return (
		<View style={styles.container}>
			{/* View Mode Toggle */}
			<View style={styles.toolbar}>
				<TouchableOpacity
					style={styles.toolbarButton}
					onPress={() => {
						setViewMode("comparison");
						setIsEditing(false);
					}}
					activeOpacity={0.7}
				>
					<Text style={styles.toolbarButtonText}>Compare</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.toolbarButton, styles.toolbarButtonActive]}
					activeOpacity={0.7}
				>
					<Text style={styles.toolbarButtonText}>Edit Manually</Text>
				</TouchableOpacity>
			</View>

			{/* Editor */}
			<View style={styles.editorContainer}>
				<View style={styles.editorHeader}>
					<Text style={styles.editorHeaderTitle}>Manual Edit</Text>
					<Text style={styles.editorHeaderSubtitle}>
						Edit the content below to resolve the conflict
					</Text>
				</View>
				<TextInput
					ref={textInputRef}
					style={styles.editorInput}
					multiline
					scrollEnabled
					value={editedContent}
					onChangeText={setEditedContent}
					placeholder="Enter the resolved content here..."
					placeholderTextColor="#888"
					textAlignVertical="top"
					autoCorrect={false}
					autoCapitalize="none"
					editable={isEditing}
				/>
			</View>

			{/* Editor Actions */}
			<View style={styles.editorActions}>
				<TouchableOpacity
					style={styles.cancelButton}
					onPress={handleCancelEdit}
					activeOpacity={0.7}
				>
					<Text style={styles.cancelButtonText}>Cancel</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.saveButton, { backgroundColor: "#8b5cf6" }]}
					onPress={handleSaveAndResolve}
					activeOpacity={0.8}
				>
					<Text style={styles.saveButtonText}>Save & Resolve</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		container: {
			flex: 1,
		},
		toolbar: {
			flexDirection: "row",
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
			paddingHorizontal: 8,
			paddingVertical: 8,
			gap: 8,
		},
		toolbarButton: {
			flex: 1,
			paddingVertical: 10,
			paddingHorizontal: 12,
			borderRadius: 6,
			backgroundColor: "#f0f0f0",
			alignItems: "center",
		},
		toolbarButtonActive: {
			backgroundColor: "#3b82f6",
		},
		toolbarButtonText: {
			fontSize: 13,
			fontWeight: "600",
			color: "#333",
		},
		comparisonContainer: {
			flex: 1,
			flexDirection: "row",
		},
		column: {
			flex: 1,
		},
		columnHeader: {
			paddingHorizontal: 12,
			paddingVertical: 8,
			borderLeftWidth: 3,
			backgroundColor: "#f9f9f9",
			borderBottomWidth: 1,
			borderBottomColor: "#eee",
		},
		columnHeaderTitle: {
			fontSize: 13,
			fontWeight: "700",
			color: "#222",
		},
		columnHeaderSubtitle: {
			fontSize: 11,
			color: "#888",
			marginTop: 1,
		},
		columnContent: {
			flex: 1,
		},
		columnText: {
			fontSize: 13,
			lineHeight: 18,
			fontFamily: "monospace",
			color: "#333",
			padding: 12,
		},
		divider: {
			width: 1,
			backgroundColor: "#ddd",
		},
		actionsContainer: {
			padding: 16,
			borderTopWidth: 1,
			borderTopColor: theme.colors.border,
		},
		actionsTitle: {
			fontSize: 14,
			fontWeight: "600",
			marginBottom: 12,
			color: theme.colors.text,
		},
		actionButtons: {
			flexDirection: "row",
			gap: 8,
		},
		actionButton: {
			flex: 1,
			paddingVertical: 12,
			paddingHorizontal: 12,
			borderRadius: 8,
			alignItems: "center",
		},
		actionButtonText: {
			color: "#fff",
			fontWeight: "600",
			fontSize: 13,
		},
		editorContainer: {
			flex: 1,
		},
		editorHeader: {
			paddingHorizontal: 16,
			paddingVertical: 12,
			backgroundColor: "#f9f9f9",
			borderBottomWidth: 1,
			borderBottomColor: "#eee",
		},
		editorHeaderTitle: {
			fontSize: 15,
			fontWeight: "700",
			color: "#222",
		},
		editorHeaderSubtitle: {
			fontSize: 12,
			color: "#888",
			marginTop: 2,
		},
		editorInput: {
			flex: 1,
			padding: 16,
			fontSize: 14,
			lineHeight: 20,
			fontFamily: "monospace",
			color: "#333",
			backgroundColor: "#fff",
		},
		editorActions: {
			flexDirection: "row",
			gap: 8,
			padding: 16,
			borderTopWidth: 1,
			borderTopColor: "#eee",
			backgroundColor: "#fafafa",
		},
		cancelButton: {
			flex: 1,
			paddingVertical: 12,
			paddingHorizontal: 16,
			borderRadius: 8,
			backgroundColor: "#f0f0f0",
			alignItems: "center",
		},
		cancelButtonText: {
			fontSize: 14,
			fontWeight: "600",
			color: "#333",
		},
		saveButton: {
			flex: 1,
			paddingVertical: 12,
			paddingHorizontal: 16,
			borderRadius: 8,
			alignItems: "center",
		},
		saveButtonText: {
			color: "#fff",
			fontWeight: "600",
			fontSize: 14,
		},
		emptyContainer: {
			flex: 1,
			justifyContent: "center",
			alignItems: "center",
			padding: 32,
		},
		emptyText: {
			fontSize: 14,
			color: theme.colors.textMuted,
			textAlign: "center",
		},
	});
}
