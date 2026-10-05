import "./shared.css";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import type React from "react";

export function FilterChip({
	label,
	selected,
	onPress,
	testID,
}: {
	label: string;
	selected: boolean;
	onPress: () => void;
	testID?: string;
}) {
	const styles = useStyles(createStyles);

	return (
		<button
			type="button"
			className="keeper-control"
			style={{ ...styles.chip, ...(selected ? styles.chipSelected : {}) }}
			aria-pressed={selected}
			onClick={onPress}
			data-testid={testID}
		>
			<span
				style={{
					...styles.chipText,
					...(selected ? styles.chipTextSelected : {}),
				}}
			>
				{label}
			</span>
		</button>
	);
}

function createStyles(theme: ExtendedTheme) {
	return {
		chip: {
			paddingLeft: 12,
			paddingRight: 12,
			paddingTop: 7,
			paddingBottom: 7,
			borderRadius: 999,
			borderWidth: 1,
			borderStyle: "solid",
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
		},
		chipSelected: {
			borderColor: theme.colors.primary,
			backgroundColor: theme.colors.primary,
		},
		chipText: {
			fontSize: 13,
			fontWeight: "600",
			color: theme.colors.textMuted,
		},
		chipTextSelected: {
			color: theme.colors.primaryContrast,
		},
	} satisfies Record<string, React.CSSProperties>;
}
