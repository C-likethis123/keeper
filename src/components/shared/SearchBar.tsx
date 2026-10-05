import "./shared.css";
import type React from "react";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { FontAwesome } from "@/components/shared/Icons";
import { forwardRef, useMemo } from "react";

export const SearchBar = forwardRef<
	HTMLInputElement,
	{
		searchQuery: string;
		setSearchQuery: (query: string) => void;
		editable?: boolean;
		compact?: boolean;
	}
>(function SearchBar(
	{ searchQuery, setSearchQuery, editable = true, compact = false },
	ref,
) {
	const theme = useExtendedTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<div
			style={{
				...styles.searchContainer,
				...(compact ? styles.searchContainerCompact : {}),
			}}
		>
			<div
				style={{
					...styles.searchInputContainer,
					...(compact ? styles.searchInputContainerCompact : {}),
				}}
			>
				<FontAwesome name="search" size={20} style={styles.searchIcon} />
				<input
					className="keeper-search-input"
					ref={ref}
					style={
						{
							...styles.searchInput,
							"--search-placeholder": theme.colors.textFaded,
							...(compact ? styles.searchInputCompact : {}),
						} as React.CSSProperties
					}
					aria-label="Search notes"
					placeholder={"Search"}
					value={searchQuery}
					onChange={(event) => setSearchQuery(event.currentTarget.value)}
					readOnly={!editable}
					spellCheck={false}
				/>
				{editable && searchQuery.length > 0 && (
					<button
						type="button"
						className="keeper-control"
						aria-label="Clear search"
						onClick={() => setSearchQuery("")}
						style={styles.clearButton}
					>
						<FontAwesome name="close" size={18} style={styles.closeIcon} />
					</button>
				)}
			</div>
		</div>
	);
});

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
		searchContainer: {
			display: "flex",
			flexDirection: "column",
			flex: 1,
			paddingLeft: 16,
			paddingRight: 16,
			paddingTop: 8,
			paddingBottom: 8,
			backgroundColor: theme.colors.background,
		},
		searchContainerCompact: {
			paddingLeft: 0,
			paddingRight: 0,
			paddingTop: 0,
			paddingBottom: 0,
			backgroundColor: "transparent",
		},
		searchInputContainer: {
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
			backgroundColor: theme.colors.card,
			borderRadius: 24,
			paddingLeft: 16,
			paddingRight: 16,
			paddingTop: 8,
			paddingBottom: 8,
			borderWidth: 0,
			borderStyle: "solid",
		},
		searchInputContainerCompact: {
			minHeight: 48,
			borderRadius: 16,
			paddingLeft: 14,
			paddingRight: 14,
			paddingTop: 6,
			paddingBottom: 6,
		},
		searchIcon: {
			marginRight: 8,
			color: theme.colors.textMuted,
		},
		closeIcon: {
			color: theme.colors.textMuted,
		},
		searchInput: {
			flex: 1,
			fontSize: 16,
			color: theme.colors.text,
			paddingTop: 0,
			paddingBottom: 0,
		},
		searchInputCompact: {
			fontSize: 15,
		},
		clearButton: {
			marginLeft: 8,
			padding: 4,
		},
	} satisfies Record<string, React.CSSProperties>;
}
