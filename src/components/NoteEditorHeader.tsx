import "@/components/shared/shared.css";
import { SaveIndicator } from "@/components/SaveIndicator";
import { useSafeAreaInsets } from "@/components/shared/SafeArea";
import type { EditorHeaderProps } from "@/features/editor/editor-header-contract";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@/components/shared/Icons";
import type React from "react";

export default function NoteEditorHeader({
	title,
	status,
	isPinned,
	onChangeTitle,
	onBlurTitle,
	onSubmitEditing,
	onBack,
	onShowHistory,
	onTogglePin,
	onDelete,
}: EditorHeaderProps) {
	const _theme = useExtendedTheme();
	const insets = useSafeAreaInsets();
	const styles = useStyles(createStyles);
	return (
		<div
			className="keeper-layout"
			style={{ ...styles.headerShell, ...{ paddingTop: insets.top + 8 } }}
		>
			<div className="keeper-layout" style={styles.headerRow}>
				<div className="keeper-layout" style={styles.headerBackRail}>
					<button
						type="button"
						className="keeper-control"
						onClick={onBack}
						style={styles.headerBackButton}
						aria-label="Back"
					>
						<FontAwesome name="arrow-left" size={24} style={styles.backIcon} />
					</button>
				</div>
				<div className="keeper-layout" style={styles.headerTitleWrapper}>
					<input
						className="keeper-input"
						style={styles.headerTitleInput}
						value={title}
						onChange={(event) => onChangeTitle(event.currentTarget.value)}
						disabled={!true}
						spellCheck={false}
						autoComplete="off"
						placeholder="Title"
						onBlur={onBlurTitle}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.nativeEvent.isComposing) {
								event.preventDefault();
								onSubmitEditing();
							}
						}}
						aria-label="Title"
					/>
				</div>
				<SaveIndicator status={status} />
				<div
					className="keeper-layout"
					style={{ ...styles.headerSideRail, ...styles.headerActionsRail }}
				>
					<button
						type="button"
						className="keeper-control"
						onClick={onShowHistory}
						style={styles.headerIconButton}
						aria-label="Version history"
					>
						<FontAwesome name="history" size={22} style={styles.historyIcon} />
					</button>
					<button
						type="button"
						className="keeper-control"
						onClick={onTogglePin}
						style={styles.headerIconButton}
						aria-label="Pin note"
					>
						<FontAwesome
							name="thumb-tack"
							size={24}
							style={[styles.pinIcon, isPinned ? styles.pinIconPinned : null]}
						/>
					</button>
					<button
						type="button"
						className="keeper-control"
						onClick={onDelete}
						style={styles.headerIconButton}
						aria-label="Delete note"
					>
						<FontAwesome name="trash" size={24} style={styles.deleteIcon} />
					</button>
				</div>
			</div>
		</div>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
		headerShell: {
			paddingLeft: 16,
			paddingRight: 16,
			paddingBottom: 8,
			backgroundColor: theme.colors.background,
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
		},
		headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
		headerBackRail: { flexDirection: "row", alignItems: "center" },
		headerSideRail: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			width: 168,
			minWidth: 168,
		},
		headerBackButton: { paddingTop: 8, paddingBottom: 8, paddingRight: 4 },
		headerTitleWrapper: { flex: 1, minWidth: 0 },
		headerTitleInput: {
			fontSize: 18,
			fontWeight: "600",
			paddingTop: 4,
			paddingBottom: 4,
			paddingLeft: 0,
			paddingRight: 0,
			color: theme.colors.text,
			width: "100%",
			minWidth: 0,
		},
		headerActionsRail: { justifyContent: "flex-end" },
		headerIconButton: {
			paddingTop: 8,
			paddingBottom: 8,
			paddingLeft: 4,
			paddingRight: 4,
		},
		backIcon: { color: theme.colors.text },
		pinIcon: { color: theme.colors.textMuted },
		historyIcon: { color: theme.colors.textMuted },
		pinIconPinned: { color: theme.colors.primary },
		deleteIcon: { color: theme.colors.textMuted },
	} satisfies Record<string, React.CSSProperties>;
}
