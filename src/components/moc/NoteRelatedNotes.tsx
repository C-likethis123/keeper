import "@/components/shared/shared.css";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { Note } from "@/services/notes/types";
import { MaterialCommunityIcons } from "@/components/shared/Icons";
import type React from "react";

interface NoteRelatedNotesProps {
	backlinks: Note[];
	outgoing: Note[];
	loading: boolean;
	onNavigate: (noteId: string) => void;
}

function NoteLink({
	note,
	onNavigate,
}: {
	note: Note;
	onNavigate: (noteId: string) => void;
}) {
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);

	return (
		<button
			type="button"
			className="keeper-control"
			style={styles.noteLink}
			onClick={() => onNavigate(note.id)}
		>
			<MaterialCommunityIcons
				name="file-document-outline"
				size={16}
				color={theme.colors.textSecondary}
			/>
			<span
				className="keeper-copy"
				style={{
					...{ ...styles.noteLinkText, ...{ color: theme.colors.text } },
					overflow: "hidden",
					display: "-webkit-box",
					WebkitBoxOrient: "vertical",
					WebkitLineClamp: 1,
				}}
			>
				{note.title || "Untitled"}
			</span>
		</button>
	);
}

function NoteList({
	title,
	icon,
	notes,
	onNavigate,
	emptyLabel,
}: {
	title: string;
	icon: string;
	notes: Note[];
	onNavigate: (noteId: string) => void;
	emptyLabel: string;
}) {
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);

	return (
		<div className="keeper-layout" style={styles.section}>
			<div className="keeper-layout" style={styles.sectionHeader}>
				<MaterialCommunityIcons
					name={icon}
					size={18}
					color={theme.colors.textSecondary}
				/>
				<span
					className="keeper-copy"
					style={{ ...styles.sectionTitle, ...{ color: theme.colors.text } }}
				>
					{title}
				</span>
				<span
					className="keeper-copy"
					style={{
						...styles.sectionCount,
						...{ color: theme.colors.textSecondary },
					}}
				>
					{notes.length}
				</span>
			</div>
			{notes.length === 0 ? (
				<span
					className="keeper-copy"
					style={{
						...styles.emptyLabel,
						...{ color: theme.colors.textSecondary },
					}}
				>
					{emptyLabel}
				</span>
			) : (
				notes.map((note) => (
					<NoteLink key={note.id} note={note} onNavigate={onNavigate} />
				))
			)}
		</div>
	);
}

export default function NoteRelatedNotes({
	backlinks,
	outgoing,
	loading,
	onNavigate,
}: NoteRelatedNotesProps) {
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);

	if (loading) {
		return (
			<div className="keeper-layout" style={styles.container}>
				<span
					className="keeper-copy"
					style={{
						...styles.loadingText,
						...{ color: theme.colors.textSecondary },
					}}
				>
					Loading related notes...
				</span>
			</div>
		);
	}

	return (
		<div
			className="keeper-layout"
			style={{ overflowY: "auto", ...styles.container }}
		>
			<div className="keeper-layout" style={{ ...styles.content }}>
				<NoteList
					title="Backlinks"
					icon="link-variant"
					notes={backlinks}
					onNavigate={onNavigate}
					emptyLabel="No notes link to this note"
				/>
				<NoteList
					title="References"
					icon="export-variant"
					notes={outgoing}
					onNavigate={onNavigate}
					emptyLabel="This note doesn't reference anything"
				/>
			</div>
		</div>
	);
}

function createStyles(_theme: ReturnType<typeof useExtendedTheme>) {
	return {
		container: { flex: 1 },
		content: { padding: 16, gap: 16 },
		loadingText: { padding: 16, textAlign: "center" },
		section: { gap: 8 },
		sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
		sectionTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
		sectionCount: { fontSize: 13, fontWeight: "400" },
		emptyLabel: { fontSize: 13, paddingLeft: 24 },
		noteLink: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
			paddingTop: 6,
			paddingBottom: 6,
			paddingLeft: 24,
		},
		noteLinkText: { fontSize: 14, flex: 1 },
	} satisfies Record<string, React.CSSProperties>;
}
