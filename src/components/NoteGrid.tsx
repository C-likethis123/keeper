import { useWindowWidth } from "@/hooks/useBrowserAppearance";
import { Spinner } from "@/components/shared/Spinner";
import "@/components/shared/shared.css";
import NoteCard from "@/components/NoteCard";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { NoteSection } from "@/services/notes/indexDb/types";
import type { Note } from "@/services/notes/types";
import { FontAwesome } from "@/components/shared/Icons";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "./shared/EmptyState";

type NoteGridRow =
	| { type: "header"; section: NoteSection }
	| {
			type: "note-row";
			notes: Note[];
			clusterActions?: NoteSection["clusterActions"];
	  };

export default function NoteGrid({
	notes,
	sections,
	emptyTitle = "No notes found",
	emptySubtitle = "Create a note to get started",
	onDelete,
	onOpen,
	onPinToggle,
	refreshing = false,
	onRefresh,
	onEndReached,
	isLoadingMore = false,
	hasMore = false,
	listHeaderComponent,
	onReady,
}: {
	notes: Note[];
	sections?: NoteSection[];
	emptyTitle?: string;
	emptySubtitle?: string;
	onDelete: (note: Note) => void;
	onOpen: (note: Note) => void;
	onPinToggle: (updated: Note) => void;
	refreshing?: boolean;
	onRefresh: () => void;
	onEndReached?: () => void;
	isLoadingMore?: boolean;
	hasMore?: boolean;
	listHeaderComponent?: React.ReactElement | null;
	onReady?: () => void;
}) {
	const width = useWindowWidth();
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);

	// Responsive column count (matches Flutter logic)
	let numColumns = 2;
	if (width > 900) numColumns = 4;
	else if (width > 600) numColumns = 3;

	const paginationGate = useRef(false);
	const listRef = useRef<HTMLElement>(null);
	const [renderLimit, setRenderLimit] = useState(20);

	const handleEndReached = useCallback(() => {
		if (paginationGate.current && hasMore && !isLoadingMore) {
			paginationGate.current = false;
			onEndReached?.();
		}
	}, [hasMore, isLoadingMore, onEndReached]);

	const rowData = useMemo(() => {
		const chunkNotes = (sectionNotes: Note[]) => {
			const rows: Note[][] = [];
			for (let index = 0; index < sectionNotes.length; index += numColumns) {
				rows.push(sectionNotes.slice(index, index + numColumns));
			}
			return rows;
		};

		if (sections && sections.length > 0) {
			const items: NoteGridRow[] = [];
			for (const section of sections) {
				items.push({ type: "header", section });
				for (const row of chunkNotes(section.notes)) {
					items.push({
						type: "note-row",
						notes: row,
						clusterActions: section.clusterActions,
					});
				}
			}
			return items;
		}

		return chunkNotes(notes).map((row) => ({
			type: "note-row" as const,
			notes: row,
			clusterActions: undefined,
		}));
	}, [notes, numColumns, sections]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Notify after changed rows commit to DOM.
	useEffect(() => {
		onReady?.();
	}, [onReady, rowData]);

	const isEmpty = rowData.length === 0;
	const keyExtractor = useCallback((item: NoteGridRow, index: number) => {
		if (item.type === "header") return `header-${item.section.id}`;
		return `note-row-${item.notes.map((note) => note.id).join("-")}-${index}`;
	}, []);

	const listHeader = useMemo(() => {
		if (!listHeaderComponent) return null;
		return (
			<div className="keeper-layout" style={styles.headerWrapper}>
				{listHeaderComponent}
			</div>
		);
	}, [listHeaderComponent, styles.headerWrapper]);

	const renderItem = useCallback(
		({ item }: { item: NoteGridRow }) => {
			if (item.type === "header") {
				return (
					<div className="keeper-layout" style={styles.sectionHeader}>
						<span className="keeper-copy" style={styles.sectionHeaderText}>
							{item.section.title}
						</span>
						{item.section.clusterActions && (
							<div
								className="keeper-layout"
								style={styles.sectionHeaderActions}
							>
								<button
									type="button"
									className="keeper-control"
									onClick={item.section.clusterActions.onRename}
									aria-label="Rename cluster"
								>
									<FontAwesome
										name="pencil"
										size={14}
										color={theme.colors.textSecondary}
									/>
								</button>
								<button
									type="button"
									className="keeper-control"
									onClick={item.section.clusterActions.onAddNote}
									aria-label="Add note to cluster"
								>
									<FontAwesome
										name="plus"
										size={14}
										color={theme.colors.textSecondary}
									/>
								</button>
								<button
									type="button"
									className="keeper-control"
									onClick={item.section.clusterActions.onDelete}
									aria-label="Delete cluster"
								>
									<FontAwesome
										name="trash"
										size={14}
										color={theme.colors.textSecondary}
									/>
								</button>
							</div>
						)}
					</div>
				);
			}

			return (
				<div className="keeper-layout" style={styles.noteRow}>
					{item.notes.map((note) => (
						<div
							className="keeper-layout"
							key={note.id}
							style={styles.noteCell}
						>
							<NoteCard
								note={note}
								onOpen={onOpen}
								onDelete={onDelete}
								onPinToggle={onPinToggle}
								onRemoveFromCluster={
									item.clusterActions
										? () => item.clusterActions?.onRemoveNote(note.id)
										: undefined
								}
							/>
						</div>
					))}
					{Array.from(
						{ length: Math.max(0, numColumns - item.notes.length) },
						(_, offset) => item.notes.length + offset + 1,
					).map((columnNumber) => (
						<div
							className="keeper-layout"
							key={`empty-column-${columnNumber}`}
							style={{ ...styles.noteCell, pointerEvents: "none" }}
						/>
					))}
				</div>
			);
		},
		[
			numColumns,
			onDelete,
			onOpen,
			onPinToggle,
			styles.noteCell,
			styles.noteRow,
			styles.sectionHeader,
			styles.sectionHeaderActions,
			styles.sectionHeaderText,
			theme.colors.textSecondary,
		],
	);

	const reachEnd = useCallback(() => {
		const list = listRef.current;
		if (!list || !paginationGate.current) return;
		if (
			list.scrollTop + list.clientHeight <
			list.scrollHeight - list.clientHeight * 0.5
		)
			return;
		if (renderLimit < rowData.length) {
			paginationGate.current = false;
			setRenderLimit((limit) => limit + 20);
		} else handleEndReached();
	}, [handleEndReached, renderLimit, rowData.length]);
	useEffect(() => {
		const list = listRef.current;
		list?.addEventListener("scrollend", reachEnd);
		return () => list?.removeEventListener("scrollend", reachEnd);
	}, [reachEnd]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Column changes restart rendered row window.
	useEffect(() => {
		setRenderLimit(20);
	}, [numColumns]);
	return (
		<section
			ref={listRef}
			aria-label="Notes"
			className="keeper-layout"
			style={{ ...styles.root, overflowY: "auto" }}
			onScroll={(event) => {
				if (event.currentTarget.scrollTop > 0) paginationGate.current = true;
				reachEnd();
			}}
		>
			<div className="keeper-layout" style={styles.contentContainer}>
				{listHeader}
				<button
					type="button"
					className="keeper-control"
					aria-label="Refresh notes"
					disabled={refreshing}
					onClick={onRefresh}
					style={{
						alignSelf: "flex-end",
						color: theme.colors.textMuted,
						padding: 8,
					}}
				>
					{refreshing ? (
						<Spinner small style={{ color: theme.colors.primary }} />
					) : (
						<FontAwesome name="refresh" size={16} />
					)}
				</button>
				{isEmpty ? (
					<EmptyState title={emptyTitle} subtitle={emptySubtitle} />
				) : (
					rowData.slice(0, renderLimit).map((item, index) => (
						<div className="keeper-layout" key={keyExtractor(item, index)}>
							{renderItem({ item })}
						</div>
					))
				)}
				{isLoadingMore && (
					<div className="keeper-layout" style={styles.footerLoader}>
						<Spinner small style={{ color: theme.colors.primary }} />
					</div>
				)}
			</div>
		</section>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
		root: { flex: 1 },
		headerWrapper: { maxWidth: 960, width: "100%", alignSelf: "center" },
		noteRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
		noteCell: { flex: 1 },
		contentContainer: { padding: 8, paddingBottom: 100 },
		footerLoader: { padding: 16, alignItems: "center" },
		sectionHeader: {
			paddingLeft: 8,
			paddingRight: 8,
			paddingTop: 12,
			paddingBottom: 12,
			marginTop: 8,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		sectionHeaderActions: { flexDirection: "row", gap: 12 },
		sectionHeaderText: {
			fontSize: 18,
			fontWeight: "700",
			color: theme.colors.text,
		},
	} satisfies Record<string, React.CSSProperties>;
}
