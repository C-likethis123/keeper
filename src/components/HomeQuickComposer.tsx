import { useColorScheme } from "@/hooks/useBrowserAppearance";
import "@/components/shared/shared.css";
import { flushAllPendingEditorDispatches } from "@/components/editor/core/pendingDispatchRegistry";
import LexicalMarkdownEditor from "@/components/editor/lexical/LexicalMarkdownEditor";
import type { LexicalEditorCommand } from "@/components/editor/lexical/extensions/CommandExtension";
import { IconButton } from "@/components/shared/IconButton";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type { NoteType } from "@/services/notes/types";
import { FontAwesome } from "@/components/shared/Icons";
import type React from "react";
import { useEffect, useRef, useState } from "react";

export default function HomeQuickComposer({
	onCreateTypedNote,
	onSave,
}: {
	onCreateTypedNote: (props?: {
		noteType?: NoteType;
		title?: string;
	}) => void;
	onSave: (draft: {
		title: string;
		content: string;
		isPinned: boolean;
	}) => Promise<void>;
}) {
	const styles = useStyles(createStyles);
	const [isExpanded, setIsExpanded] = useState(false);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const contentRef = useRef("");
	const [isPinned, setIsPinned] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const savingRef = useRef(false);
	const [editorCommand, setEditorCommand] = useState<LexicalEditorCommand>();
	const colorScheme = useColorScheme();
	const titleInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (isExpanded) titleInputRef.current?.focus();
	}, [isExpanded]);

	const expand = () => {
		setEditorCommand(undefined);
		setIsExpanded(true);
	};

	const close = async () => {
		if (savingRef.current) return;
		flushAllPendingEditorDispatches();
		const currentContent = contentRef.current;
		if (title.trim() || currentContent.trim()) {
			setIsSaving(true);
			savingRef.current = true;
			try {
				await onSave({
					title: title.trim(),
					content: currentContent,
					isPinned,
				});
			} catch {
				return;
			} finally {
				savingRef.current = false;
				setIsSaving(false);
			}
		}
		setTitle("");
		setContent("");
		contentRef.current = "";
		setIsPinned(false);
		setEditorCommand(undefined);
		setIsExpanded(false);
	};

	return (
		<div className="keeper-layout" style={styles.wrapper}>
			<div
				className="keeper-layout"
				data-testid="home-quick-composer-card"
				style={{ ...styles.card, ...(isExpanded ? styles.cardExpanded : {}) }}
			>
				{isExpanded ? (
					<>
						<input
							className="keeper-input"
							ref={titleInputRef}
							aria-label="Note title"
							placeholder="Title"
							value={title}
							onChange={(event) => setTitle(event.currentTarget.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.nativeEvent.isComposing) {
									event.preventDefault();
									(() =>
										setEditorCommand({
											type: "focusEditor",
											timestamp: Date.now(),
										}))();
								}
							}}
							style={styles.titleInput}
						/>
						<div className="keeper-layout" style={styles.contentInput}>
							<LexicalMarkdownEditor
								accessibilityLabel="Note content"
								autoFocus={false}
								command={editorCommand}
								markdown={content}
								noteId="home-quick-composer"
								onMarkdownChange={(nextContent) => {
									contentRef.current = nextContent;
									setContent(nextContent);
								}}
								persistDraft={false}
								themeMode={colorScheme ?? "dark"}
								variant="compact"
							/>
						</div>
						<button
							type="button"
							className="keeper-control"
							aria-label={isPinned ? "Unpin note" : "Pin note"}
							aria-pressed={isPinned}
							onClick={() => setIsPinned((current) => !current)}
							style={styles.pinButton}
						>
							<FontAwesome
								name="thumb-tack"
								size={20}
								color={
									isPinned ? styles.pinIconPinned.color : styles.pinIcon.color
								}
							/>
						</button>
						<div className="keeper-layout" style={styles.expandedFooter}>
							<button
								type="button"
								className="keeper-control"
								aria-label="Close note"
								disabled={isSaving}
								onClick={() => void close()}
								style={{ ...styles.closeButton }}
							>
								<span className="keeper-copy" style={styles.closeButtonText}>
									{isSaving ? "Saving..." : "Close"}
								</span>
							</button>
						</div>
					</>
				) : (
					<>
						<button
							type="button"
							className="keeper-control"
							aria-label="Take a note"
							style={{ ...styles.primaryAction }}
							onClick={expand}
						>
							<span className="keeper-copy" style={styles.placeholder}>
								Take a note...
							</span>
						</button>
						<div className="keeper-layout" style={styles.actions}>
							<IconButton
								label="Create todo"
								name="check-square-o"
								variant="flat"
								onPress={() =>
									onCreateTypedNote({ noteType: "todo", title: "TODO:" })
								}
							/>
							<IconButton
								label="Create journal"
								name="pencil"
								variant="flat"
								onPress={() =>
									onCreateTypedNote({
										noteType: "journal",
										title: "Journal: ",
									})
								}
							/>
							<IconButton
								label="Create resource"
								name="bookmark-o"
								variant="flat"
								onPress={() =>
									onCreateTypedNote({
										noteType: "resource",
										title: "Source: ",
									})
								}
							/>
							<IconButton
								label="Create drawing"
								name="paint-brush"
								variant="flat"
								onPress={() => onCreateTypedNote({ noteType: "drawing" })}
							/>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
		wrapper: {
			paddingTop: 12,
			paddingBottom: 16,
			paddingLeft: 8,
			paddingRight: 8,
		},
		card: {
			boxShadow: `0px 4px 10px color-mix(in srgb, ${theme.colors.shadow} ${0.12 * 100}%, transparent)`,
			maxWidth: 640,
			width: "100%",
			alignSelf: "center",
			minHeight: 60,
			paddingLeft: 18,
			paddingRight: 18,
			paddingTop: 14,
			paddingBottom: 14,
			borderRadius: 16,
			backgroundColor: theme.colors.card,
			borderWidth: 1,
			borderColor: theme.colors.border,
			flexDirection: "row",
			alignItems: "center",
		},
		cardExpanded: {
			maxWidth: 860,
			minHeight: 220,
			paddingTop: 14,
			paddingBottom: 10,
			flexDirection: "column",
			alignItems: "stretch",
			borderRadius: 12,
		},
		primaryAction: { flex: 1 },

		placeholder: { flex: 1, fontSize: 20, color: theme.colors.textMuted },
		titleInput: {
			minHeight: 44,
			paddingRight: 44,
			fontSize: 18,
			fontWeight: "600",
			color: theme.colors.text,
		},
		contentInput: { minHeight: 104, height: 120, overflow: "hidden" },
		pinButton: {
			position: "absolute",
			top: 8,
			right: 10,
			width: 40,
			height: 40,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 20,
		},
		pinIcon: { color: theme.colors.textMuted },
		pinIconPinned: { color: theme.colors.primary },
		expandedFooter: {
			minHeight: 40,
			alignItems: "flex-end",
			justifyContent: "center",
		},
		closeButton: {
			paddingLeft: 16,
			paddingRight: 16,
			paddingTop: 9,
			paddingBottom: 9,
			borderRadius: 8,
		},
		closeButtonText: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
		},
		actions: {
			flexDirection: "row",
			alignItems: "center",
			gap: 16,
			marginLeft: 16,
		},
	} satisfies Record<string, React.CSSProperties>;
}
