import { useState, useRef, useMemo } from "react";
import type { GitConflictFile } from "@/services/git/engines/GitEngine";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import {
	Alert,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import diffSequences from "diff-sequences";

type ViewMode = "diff" | "comparison" | "edit";

type DiffLine =
	| { type: "common"; text: string }
	| { type: "removed"; text: string }
	| { type: "added"; text: string };

function computeLineDiff(a: string, b: string): DiffLine[] {
	const aLines = a.split("\n");
	const bLines = b.split("\n");
	const result: DiffLine[] = [];

	let aIdx = 0;
	let bIdx = 0;

	diffSequences(
		aLines.length,
		bLines.length,
		(ai, bi) => aLines[ai] === bLines[bi],
		(nCommon, aCommon, bCommon) => {
			while (aIdx < aCommon) {
				result.push({ type: "removed", text: aLines[aIdx++] });
			}
			while (bIdx < bCommon) {
				result.push({ type: "added", text: bLines[bIdx++] });
			}
			for (let i = 0; i < nCommon; i++) {
				result.push({ type: "common", text: aLines[aCommon + i] });
				aIdx++;
				bIdx++;
			}
		},
	);

	while (aIdx < aLines.length) {
		result.push({ type: "removed", text: aLines[aIdx++] });
	}
	while (bIdx < bLines.length) {
		result.push({ type: "added", text: bLines[bIdx++] });
	}

	return result;
}

interface ConflictComparisonViewProps {
	conflict: GitConflictFile;
	onResolve: (strategy: "ours" | "theirs" | "base" | "manual", manualContent?: string) => void;
}

export default function ConflictComparisonView({
	conflict,
	onResolve,
}: ConflictComparisonViewProps) {
	const styles = useStyles(createStyles);
	const [viewMode, setViewMode] = useState<ViewMode>("diff");
	const [editedContent, setEditedContent] = useState("");
	const textInputRef = useRef<TextInput>(null);

	const diffLines = useMemo(() => {
		if (conflict.oursContent === null || conflict.theirsContent === null) return null;
		return computeLineDiff(conflict.oursContent, conflict.theirsContent);
	}, [conflict.oursContent, conflict.theirsContent]);

	const handleEnterEditMode = () => {
		setEditedContent(conflict.oursContent ?? conflict.theirsContent ?? "");
		setViewMode("edit");
	};

	const handleCancelEdit = () => {
		if (Platform.OS === "web") {
			if (window.confirm("Discard Changes? Your edits will be lost. Continue anyway?")) {
				setViewMode("diff");
			}
			return;
		}

		Alert.alert(
			"Discard Changes?",
			"Your edits will be lost. Continue anyway?",
			[
				{ text: "Keep Editing", style: "cancel" },
				{
					text: "Discard",
					style: "destructive",
					onPress: () => setViewMode("diff"),
				},
			],
		);
	};

	const handleSaveAndResolve = () => {
		if (!editedContent.trim()) {
			if (Platform.OS === "web") {
				if (window.confirm("Empty Content: The file will be empty. Are you sure?")) {
					onResolve("manual", editedContent);
				}
				return;
			}

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
		conflict.baseContent !== null ||
		conflict.oursContent !== null ||
		conflict.theirsContent !== null;

	if (!hasContent) {
		return (
			<View style={styles.emptyContainer}>
				<Text style={styles.emptyText}>No content available for this conflict</Text>
			</View>
		);
	}

	if (viewMode === "diff") {
		return (
			<View style={styles.container}>
				<View style={styles.toolbar}>
					<TouchableOpacity style={[styles.toolbarButton, styles.toolbarButtonActive]} activeOpacity={0.7}>
						<Text style={[styles.toolbarButtonText, styles.toolbarButtonTextActive]}>Diff</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.toolbarButton} onPress={() => setViewMode("comparison")} activeOpacity={0.7}>
						<Text style={styles.toolbarButtonText}>Side by Side</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.toolbarButton} onPress={handleEnterEditMode} activeOpacity={0.7}>
						<Text style={styles.toolbarButtonText}>Edit</Text>
					</TouchableOpacity>
				</View>

				{diffLines ? (
					<ScrollView style={styles.diffScroll}>
						<View style={styles.diffLegend}>
							<View style={styles.diffLegendItem}>
								<View style={[styles.diffLegendDot, { backgroundColor: "#dc2626" }]} />
								<Text style={styles.diffLegendText}>Local only</Text>
							</View>
							<View style={styles.diffLegendItem}>
								<View style={[styles.diffLegendDot, { backgroundColor: "#16a34a" }]} />
								<Text style={styles.diffLegendText}>Remote only</Text>
							</View>
						</View>
						{diffLines.map((line, i) => (
							<View
								key={i}
								style={[
									styles.diffLine,
									line.type === "removed" && styles.diffLineRemoved,
									line.type === "added" && styles.diffLineAdded,
								]}
							>
								<Text
									style={[
										styles.diffLinePrefix,
										line.type === "removed" && styles.diffLinePrefixRemoved,
										line.type === "added" && styles.diffLinePrefixAdded,
									]}
								>
									{line.type === "removed" ? "-" : line.type === "added" ? "+" : " "}
								</Text>
								<Text
									style={[
										styles.diffLineText,
										line.type === "removed" && styles.diffLineTextRemoved,
										line.type === "added" && styles.diffLineTextAdded,
									]}
									selectable
								>
									{line.text}
								</Text>
							</View>
						))}
					</ScrollView>
				) : (
					<ScrollView style={styles.diffScroll}>
						{conflict.oursContent !== null && (
							<>
								<View style={styles.diffOnlyHeader}>
									<Text style={styles.diffOnlyHeaderText}>Local version (no remote to compare)</Text>
								</View>
								<Text style={styles.columnText}>{conflict.oursContent}</Text>
							</>
						)}
						{conflict.theirsContent !== null && (
							<>
								<View style={[styles.diffOnlyHeader, { borderLeftColor: "#10b981" }]}>
									<Text style={styles.diffOnlyHeaderText}>Remote version (no local to compare)</Text>
								</View>
								<Text style={styles.columnText}>{conflict.theirsContent}</Text>
							</>
						)}
					</ScrollView>
				)}

				<View style={styles.actionsContainer}>
					<Text style={styles.actionsTitle}>Resolve by keeping:</Text>
					<View style={styles.actionButtons}>
						{conflict.oursContent !== null && (
							<TouchableOpacity
								style={[styles.actionButton, { backgroundColor: "#3b82f6" }]}
								onPress={() => onResolve("ours")}
								activeOpacity={0.8}
							>
								<Text style={styles.actionButtonText}>Local</Text>
							</TouchableOpacity>
						)}
						{conflict.theirsContent !== null && (
							<TouchableOpacity
								style={[styles.actionButton, { backgroundColor: "#10b981" }]}
								onPress={() => onResolve("theirs")}
								activeOpacity={0.8}
							>
								<Text style={styles.actionButtonText}>Remote</Text>
							</TouchableOpacity>
						)}
						<TouchableOpacity
							style={[styles.actionButton, { backgroundColor: "#8b5cf6" }]}
							onPress={handleEnterEditMode}
							activeOpacity={0.8}
						>
							<Text style={styles.actionButtonText}>Edit</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		);
	}

	if (viewMode === "comparison") {
		return (
			<View style={styles.container}>
				<View style={styles.toolbar}>
					<TouchableOpacity style={styles.toolbarButton} onPress={() => setViewMode("diff")} activeOpacity={0.7}>
						<Text style={styles.toolbarButtonText}>Diff</Text>
					</TouchableOpacity>
					<TouchableOpacity style={[styles.toolbarButton, styles.toolbarButtonActive]} activeOpacity={0.7}>
						<Text style={[styles.toolbarButtonText, styles.toolbarButtonTextActive]}>Side by Side</Text>
					</TouchableOpacity>
					<TouchableOpacity style={styles.toolbarButton} onPress={handleEnterEditMode} activeOpacity={0.7}>
						<Text style={styles.toolbarButtonText}>Edit</Text>
					</TouchableOpacity>
				</View>

				<View style={styles.comparisonContainer}>
					{conflict.oursContent !== null && (
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

					{conflict.oursContent !== null && conflict.theirsContent !== null && (
						<View style={styles.divider} />
					)}

					{conflict.theirsContent !== null && (
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

				</View>

				<View style={styles.actionsContainer}>
					<Text style={styles.actionsTitle}>Resolve by keeping:</Text>
					<View style={styles.actionButtons}>
						{conflict.oursContent !== null && (
							<TouchableOpacity
								style={[styles.actionButton, { backgroundColor: "#3b82f6" }]}
								onPress={() => onResolve("ours")}
								activeOpacity={0.8}
							>
								<Text style={styles.actionButtonText}>Local Version</Text>
							</TouchableOpacity>
						)}
						{conflict.theirsContent !== null && (
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

	return (
		<View style={styles.container}>
			<View style={styles.toolbar}>
				<TouchableOpacity style={styles.toolbarButton} onPress={() => setViewMode("diff")} activeOpacity={0.7}>
					<Text style={styles.toolbarButtonText}>Diff</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.toolbarButton} onPress={() => setViewMode("comparison")} activeOpacity={0.7}>
					<Text style={styles.toolbarButtonText}>Side by Side</Text>
				</TouchableOpacity>
				<TouchableOpacity style={[styles.toolbarButton, styles.toolbarButtonActive]} activeOpacity={0.7}>
					<Text style={[styles.toolbarButtonText, styles.toolbarButtonTextActive]}>Edit</Text>
				</TouchableOpacity>
			</View>

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
					editable={viewMode === "edit"}
				/>
			</View>

			<View style={styles.editorActions}>
				<TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit} activeOpacity={0.7}>
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
			backgroundColor: "#1e293b",
		},
		toolbarButtonText: {
			fontSize: 13,
			fontWeight: "600",
			color: "#333",
		},
		toolbarButtonTextActive: {
			color: "#fff",
		},
		// Diff view
		diffScroll: {
			flex: 1,
		},
		diffLegend: {
			flexDirection: "row",
			gap: 16,
			paddingHorizontal: 12,
			paddingVertical: 8,
			borderBottomWidth: 1,
			borderBottomColor: "#eee",
			backgroundColor: "#fafafa",
		},
		diffLegendItem: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
		},
		diffLegendDot: {
			width: 10,
			height: 10,
			borderRadius: 5,
		},
		diffLegendText: {
			fontSize: 12,
			color: "#555",
		},
		diffLine: {
			flexDirection: "row",
			paddingVertical: 1,
		},
		diffLineRemoved: {
			backgroundColor: "#fef2f2",
		},
		diffLineAdded: {
			backgroundColor: "#f0fdf4",
		},
		diffLinePrefix: {
			width: 20,
			fontFamily: "monospace",
			fontSize: 13,
			lineHeight: 20,
			textAlign: "center",
			color: "#aaa",
			flexShrink: 0,
		},
		diffLinePrefixRemoved: {
			color: "#dc2626",
			fontWeight: "700",
		},
		diffLinePrefixAdded: {
			color: "#16a34a",
			fontWeight: "700",
		},
		diffLineText: {
			flex: 1,
			fontFamily: "monospace",
			fontSize: 13,
			lineHeight: 20,
			color: "#333",
			paddingRight: 8,
		},
		diffLineTextRemoved: {
			color: "#991b1b",
		},
		diffLineTextAdded: {
			color: "#166534",
		},
		diffOnlyHeader: {
			paddingHorizontal: 12,
			paddingVertical: 8,
			borderLeftWidth: 3,
			borderLeftColor: "#3b82f6",
			backgroundColor: "#f9f9f9",
			borderBottomWidth: 1,
			borderBottomColor: "#eee",
			marginBottom: 4,
		},
		diffOnlyHeaderText: {
			fontSize: 12,
			color: "#555",
			fontStyle: "italic",
		},
		// Side-by-side comparison
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
		// Edit mode
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
