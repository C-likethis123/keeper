import { Dialog } from "@/components/shared/Dialog";
import type React from "react";
import "@/components/shared/shared.css";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { useState } from "react";

type RenameClusterModalProps = {
	visible: boolean;
	initialName: string;
	onClose: () => void;
	onConfirm: (newName: string) => void;
	onRename?: (newName: string) => void;
};

export default function RenameClusterModal({
	visible,
	initialName,
	onClose,
	onConfirm,
	onRename,
}: RenameClusterModalProps) {
	const styles = useStyles(createStyles);
	const [name, setName] = useState(initialName);

	const handleConfirm = () => {
		const trimmed = name.trim();
		if (trimmed) {
			onConfirm(trimmed);
			onRename?.(trimmed);
		}
	};

	return (
		<Dialog
			label="Rename Cluster Modal"
			open={visible}
			onDismiss={onClose}
			onOpen={() => setName(initialName)}
		>
			<div className="keeper-layout" style={styles.backdrop}>
				<div className="keeper-layout" style={styles.card}>
					<span className="keeper-copy" style={styles.title}>
						Rename Cluster
					</span>
					<input
						className="keeper-input"
						style={styles.input}
						value={name}
						onChange={(event) => setName(event.currentTarget.value)}
						onFocus={(event) => event.currentTarget.select()}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.nativeEvent.isComposing) {
								event.preventDefault();
								handleConfirm();
							}
						}}
					/>
					<div className="keeper-layout" style={styles.actions}>
						<button
							type="button"
							className="keeper-control"
							style={styles.cancelButton}
							onClick={onClose}
						>
							<span className="keeper-copy" style={styles.cancelText}>
								Cancel
							</span>
						</button>
						<button
							type="button"
							className="keeper-control"
							style={styles.confirmButton}
							onClick={handleConfirm}
							disabled={!name.trim()}
						>
							<span className="keeper-copy" style={styles.confirmText}>
								Rename
							</span>
						</button>
					</div>
				</div>
			</div>
		</Dialog>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
		backdrop: {
			flex: 1,
			backgroundColor: "rgba(0, 0, 0, 0.35)",
			justifyContent: "center",
			padding: 20,
		},
		card: {
			borderRadius: 16,
			padding: 20,
			backgroundColor: theme.colors.background,
			borderWidth: 1,
			borderColor: theme.colors.border,
			gap: 12,
		},
		title: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
		input: {
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			paddingLeft: 12,
			paddingRight: 12,
			paddingTop: 10,
			paddingBottom: 10,
			fontSize: 15,
			color: theme.colors.text,
			backgroundColor: theme.colors.card,
		},
		actions: {
			flexDirection: "row",
			justifyContent: "flex-end",
			gap: 12,
			marginTop: 4,
		},
		cancelButton: {
			paddingLeft: 14,
			paddingRight: 14,
			paddingTop: 10,
			paddingBottom: 10,
			borderRadius: 10,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
		},
		cancelText: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
		confirmButton: {
			paddingLeft: 14,
			paddingRight: 14,
			paddingTop: 10,
			paddingBottom: 10,
			borderRadius: 10,
			backgroundColor: theme.colors.primary,
		},
		confirmText: { fontSize: 14, fontWeight: "700", color: theme.colors.card },
	} satisfies Record<string, React.CSSProperties>;
}
