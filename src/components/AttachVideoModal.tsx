import { Dialog } from "@/components/shared/Dialog";
import "@/components/shared/shared.css";
import { parseEmbeddedVideoUrl } from "@/components/editor/video/videoUtils";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@/components/shared/Icons";
import type React from "react";
import { useEffect, useState } from "react";

export default function AttachVideoModal({
	visible,
	currentVideo,
	onDismiss,
	onSave,
	onRemove,
}: {
	visible: boolean;
	currentVideo?: string | null;
	onDismiss: () => void;
	onSave: (url: string) => void;
	onRemove: () => void;
}) {
	const styles = useStyles(createStyles);
	const [value, setValue] = useState(currentVideo ?? "");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (visible) {
			setValue(currentVideo ?? "");
			setError(null);
		}
	}, [visible, currentVideo]);

	if (!visible) return null;

	const handleSave = () => {
		const trimmed = value.trim();
		if (!trimmed) {
			setError("Please enter a YouTube URL");
			return;
		}
		const parsed = parseEmbeddedVideoUrl(trimmed);
		if (!parsed) {
			setError("Not a valid YouTube URL");
			return;
		}
		setError(null);
		onSave(trimmed);
	};

	const handleRemove = () => {
		setValue("");
		setError(null);
		onRemove();
	};

	return (
		<Dialog label="Attach Video Modal" open={visible} onDismiss={onDismiss}>
			<div className="keeper-layout" style={styles.modalBackdrop}>
				<div className="keeper-layout" style={styles.modalCard}>
					<div className="keeper-layout" style={styles.modalHeader}>
						<span className="keeper-copy" style={styles.modalTitle}>
							Attach Video
						</span>
						<button
							type="button"
							className="keeper-control"
							onClick={onDismiss}
						>
							<FontAwesome name="close" size={22} style={styles.closeIcon} />
						</button>
					</div>
					<input
						className="keeper-input"
						style={styles.input}
						placeholder="https://www.youtube.com/watch?v=..."
						value={value}
						onChange={(event) =>
							((t) => {
								setValue(t);
								setError(null);
							})(event.currentTarget.value)
						}
						spellCheck={false}
						inputMode="url"
					/>
					{error ? (
						<span className="keeper-copy" style={styles.errorText}>
							{error}
						</span>
					) : null}
					<div className="keeper-layout" style={styles.buttonRow}>
						<button
							type="button"
							className="keeper-control"
							style={styles.cancelButton}
							onClick={onDismiss}
						>
							<span className="keeper-copy" style={styles.cancelButtonText}>
								Cancel
							</span>
						</button>
						<button
							type="button"
							className="keeper-control"
							style={styles.saveButton}
							onClick={handleSave}
						>
							<span className="keeper-copy" style={styles.saveButtonText}>
								Save
							</span>
						</button>
					</div>
					{currentVideo ? (
						<button
							type="button"
							className="keeper-control"
							style={styles.removeButton}
							onClick={handleRemove}
						>
							<span className="keeper-copy" style={styles.removeButtonText}>
								Remove video
							</span>
						</button>
					) : null}
				</div>
			</div>
		</Dialog>
	);
}

function createStyles(theme: ExtendedTheme) {
	return {
		modalBackdrop: {
			flex: 1,
			backgroundColor: "rgba(0, 0, 0, 0.35)",
			justifyContent: "center",
			padding: 20,
		},
		modalCard: {
			borderRadius: 16,
			padding: 16,
			backgroundColor: theme.colors.background,
			borderWidth: 1,
			borderColor: theme.colors.border,
			gap: 12,
		},
		modalHeader: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		closeIcon: { color: theme.colors.text },
		modalTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
		input: {
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			paddingLeft: 12,
			paddingRight: 12,
			paddingTop: 10,
			paddingBottom: 10,
			fontSize: 14,
			color: theme.colors.text,
			backgroundColor: theme.colors.card,
		},
		placeholder: { color: theme.colors.textMuted },
		errorText: { fontSize: 13, color: "#e03e3e" },
		buttonRow: { flexDirection: "row", gap: 8 },
		cancelButton: {
			flex: 1,
			paddingTop: 10,
			paddingBottom: 10,
			borderRadius: 8,
			borderWidth: 1,
			borderColor: theme.colors.border,
			alignItems: "center",
		},
		cancelButtonText: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
		},
		saveButton: {
			flex: 1,
			paddingTop: 10,
			paddingBottom: 10,
			borderRadius: 8,
			backgroundColor: "#007AFF",
			alignItems: "center",
		},
		saveButtonText: { fontSize: 14, fontWeight: "600", color: "#fff" },
		removeButton: {
			paddingTop: 10,
			paddingBottom: 10,
			borderRadius: 8,
			borderWidth: 1,
			borderColor: "#e03e3e",
			alignItems: "center",
		},
		removeButtonText: { fontSize: 14, fontWeight: "600", color: "#e03e3e" },
	} satisfies Record<string, React.CSSProperties>;
}
