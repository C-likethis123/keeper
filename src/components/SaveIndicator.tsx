import "@/components/shared/shared.css";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@/components/shared/Icons";
import type React from "react";

export type SaveStatus = "idle" | "saving" | "saved";

type Props = {
	status: SaveStatus;
};

const titleMap = {
	saving: "Saving…",
	saved: "Saved",
};

const iconNameMap = {
	saving: "spinner" as const,
	saved: "check-circle" as const,
} as const;

export function SaveIndicator({ status }: Props) {
	const styles = useStyles(createStyles);

	if (status === "idle") {
		return null;
	}

	const iconName = iconNameMap[status];
	return (
		<div className="keeper-layout" style={styles.container}>
			<FontAwesome
				name={iconName}
				size={16}
				style={status === "saving" ? styles.savingIcon : styles.savedIcon}
			/>
			<div className="keeper-layout" style={styles.textContainer}>
				<span
					className="keeper-copy"
					style={{
						...styles.title,
						overflow: "hidden",
						display: "-webkit-box",
						WebkitBoxOrient: "vertical",
						WebkitLineClamp: 1,
					}}
				>
					{titleMap[status]}
				</span>
			</div>
		</div>
	);
}
function createStyles(theme: ExtendedTheme) {
	return {
		container: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			maxWidth: 220,
		},
		textContainer: { flexShrink: 1 },
		title: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
		subtitle: { fontSize: 11, color: theme.colors.textMuted },
		icon: { color: theme.colors.text },
		savingIcon: { color: theme.colors.statusSaving },
		savedIcon: { color: theme.colors.statusSaved },
	} satisfies Record<string, React.CSSProperties>;
}
