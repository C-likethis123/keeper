import type React from "react";
import "@/components/shared/shared.css";
import DrawingPreview from "@/components/drawing/DrawingPreview";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { Note } from "@/services/notes/types";
import { FontAwesome } from "@/components/shared/Icons";
import { memo, useCallback, useMemo } from "react";

function formatNoteType(note: Note): string | null {
	if (!note.noteType || note.noteType === "note") return null;
	if (note.noteType === "todo") {
		if (note.status === "done") return "TODO DONE";
		if (note.status === "doing") return "TODO DOING";
		if (note.status === "blocked") return "TODO BLOCKED";
		return "TODO";
	}
	return note.noteType.toUpperCase();
}

function NoteCard({
	note,
	onOpen,
	onDelete,
	onPinToggle,
	onRemoveFromCluster,
}: {
	note: Note;
	onOpen: (note: Note) => void;
	onDelete: (note: Note) => void;
	onPinToggle: (updated: Note) => void;
	onRemoveFromCluster?: () => void;
}) {
	const styles = useStyles(createStyles);
	const typeLabel = useMemo(() => formatNoteType(note), [note]);
	const formattedDate = useMemo(
		() => new Date(note.lastUpdated).toLocaleDateString(),
		[note.lastUpdated],
	);
	const openNote = useCallback(() => {
		onOpen(note);
	}, [note, onOpen]);

	const handlePinToggle = useCallback(() => {
		const updated = { ...note, isPinned: !note.isPinned };
		onPinToggle?.(updated);
	}, [note, onPinToggle]);

	return (
		<div className="keeper-layout" style={styles.card}>
			<button
				type="button"
				className="keeper-control"
				style={{ ...styles.openArea }}
				onClick={openNote}
				aria-label={`Open note ${note.title || "Untitled"}`}
			>
				<div className="keeper-layout" style={styles.titleRow}>
					<span
						className="keeper-copy"
						style={{
							...styles.title,
							overflow: "hidden",
							display: "-webkit-box",
							WebkitBoxOrient: "vertical",
							WebkitLineClamp: 2,
						}}
					>
						{note.title}
					</span>
					{note.isPinned ? (
						<FontAwesome
							name="thumb-tack"
							size={18}
							style={styles.activeIconButton}
						/>
					) : null}
				</div>

				{note.noteType === "drawing" ? (
					<div className="keeper-layout" style={styles.drawingPreview}>
						<DrawingPreview content={note.content} />
					</div>
				) : (
					<span
						className="keeper-copy"
						style={{
							...styles.content,
							overflow: "hidden",
							display: "-webkit-box",
							WebkitBoxOrient: "vertical",
							WebkitLineClamp: 3,
						}}
					>
						{note.content}
					</span>
				)}

				{typeLabel && (
					<div className="keeper-layout" style={styles.badges}>
						{typeLabel ? (
							<div className="keeper-layout" style={styles.badge}>
								<span className="keeper-copy" style={styles.badgeText}>
									{typeLabel}
								</span>
							</div>
						) : null}
					</div>
				)}
			</button>

			<div className="keeper-layout" style={styles.footer}>
				<span className="keeper-copy" style={styles.date}>
					{formattedDate}
				</span>

				<div className="keeper-layout" style={styles.actions}>
					{onRemoveFromCluster && (
						<button
							type="button"
							className="keeper-control"
							onClick={onRemoveFromCluster}
							aria-label="Remove from cluster"
						>
							<FontAwesome name="times" size={18} style={styles.iconButton} />
						</button>
					)}
					<button
						type="button"
						className="keeper-control"
						onClick={handlePinToggle}
						aria-label={note.isPinned ? "Unpin note" : "Pin note"}
					>
						<FontAwesome
							name="thumb-tack"
							size={18}
							style={
								note.isPinned ? styles.activeIconButton : styles.iconButton
							}
						/>
					</button>
					<button
						type="button"
						className="keeper-control"
						onClick={() => onDelete(note)}
						aria-label="Delete note"
					>
						<FontAwesome name="trash-o" size={18} style={styles.iconButton} />
					</button>
				</div>
			</div>
		</div>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
		card: {
			flex: 1,
			borderRadius: 12,
			borderWidth: 1,
			borderColor: theme.colors.border,
			padding: 12,
			backgroundColor: theme.colors.card,
		},
		openArea: { flexGrow: 1 },

		activeIconButton: { color: theme.colors.primary },
		iconButton: { color: theme.colors.textMuted },
		titleRow: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
		title: {
			flex: 1,
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
		},
		content: { marginTop: 6, color: theme.colors.textMuted, flexGrow: 1 },
		drawingPreview: {
			marginTop: 8,
			borderRadius: 8,
			overflow: "hidden",
			borderWidth: 1,
			borderColor: theme.colors.border,
		},
		badges: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
		badge: {
			borderRadius: 999,
			borderWidth: 1,
			borderColor: theme.colors.border,
			paddingLeft: 8,
			paddingRight: 8,
			paddingTop: 3,
			paddingBottom: 3,
			backgroundColor: theme.colors.background,
		},
		badgeText: {
			fontSize: 11,
			fontWeight: "600",
			color: theme.colors.textMuted,
		},
		footer: { marginTop: 8, flexDirection: "row", alignItems: "center" },
		date: { flex: 1, fontSize: 12, color: theme.colors.textFaded },
		actions: { flexDirection: "row", gap: 12 },
	} satisfies Record<string, React.CSSProperties>;
}

export default memo(NoteCard);
