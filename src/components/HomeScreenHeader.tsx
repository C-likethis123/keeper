import "@/components/shared/shared.css";
import { IconButton } from "@/components/shared/IconButton";
import { SearchBar } from "@/components/shared/SearchBar";
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import type React from "react";
import { useSafeAreaInsets } from "@/components/shared/SafeArea";

export default function HomeScreenHeader({
	searchQuery,
	setSearchQuery,
	searchInputRef,
	onMenuPress,
	onOpenSuggestedMocs,
}: {
	searchQuery: string;
	setSearchQuery: (query: string) => void;
	searchInputRef?: React.Ref<HTMLInputElement>;
	onMenuPress: () => void;
	onOpenSuggestedMocs: () => void;
}) {
	const styles = useStyles(createStyles);
	const insets = useSafeAreaInsets();

	return (
		<div
			className="keeper-layout"
			style={{ ...styles.shell, ...{ paddingTop: insets.top + 12 } }}
		>
			<div className="keeper-layout" style={styles.row}>
				<IconButton
					name="bars"
					label="Open filters"
					variant="flat"
					tooltipAlignment="start"
					tooltipPlacement="bottom"
					onPress={onMenuPress}
				/>
				<SearchBar
					ref={searchInputRef}
					searchQuery={searchQuery}
					setSearchQuery={setSearchQuery}
					compact
				/>
				<IconButton
					label="Open suggested MOCs"
					name="sitemap"
					variant="flat"
					tooltipAlignment="end"
					tooltipPlacement="bottom"
					onPress={onOpenSuggestedMocs}
				/>
			</div>
		</div>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
		shell: {
			position: "relative",
			zIndex: 40,
			paddingLeft: 16,
			paddingRight: 16,
			paddingTop: 12,
			paddingBottom: 8,
			backgroundColor: theme.colors.background,
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
		},
		row: { flexDirection: "row", alignItems: "center", gap: 12 },
	} satisfies Record<string, React.CSSProperties>;
}
