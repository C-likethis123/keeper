import { Spinner } from "./Spinner";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type React from "react";

export default function Loader() {
	const styles = useStyles(createStyles);

	return (
		<div style={styles.container} aria-label="Loading notes">
			<Spinner style={styles.indicator} />
		</div>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
		container: {
			display: "flex",
			flexDirection: "column",
			flex: 1,
			justifyContent: "center",
			alignItems: "center",
			backgroundColor: theme.colors.background,
		},
		indicator: {
			color: theme.colors.primary,
		},
	} satisfies Record<string, React.CSSProperties>;
}
