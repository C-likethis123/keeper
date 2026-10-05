import "@/components/shared/shared.css";
import Loader from "@/components/shared/Loader";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import type React from "react";

export interface WikiLinkResult {
	id: string;
	type: "existing" | "create";
	title: string;
	noteId?: string;
}

interface WikiLinkOverlayProps {
	results: WikiLinkResult[];
	selectedIndex: number;
	isLoading?: boolean;
	onSelect: (result: WikiLinkResult) => void;
}

const MAX_HEIGHT = 200;
const ITEM_HEIGHT = 40;

/// Dropdown overlay for wiki link autocomplete
export function WikiLinkOverlay({
	results,
	selectedIndex,
	isLoading = false,
	onSelect,
}: WikiLinkOverlayProps) {
	const styles = useStyles(createStyles);
	const _needsScrolling = results.length * ITEM_HEIGHT > MAX_HEIGHT;
	return (
		<div className="keeper-layout" style={styles.container}>
			{isLoading ? (
				<Loader />
			) : (
				<div
					className="keeper-layout"
					style={{ overflowY: "auto", ...styles.scrollView }}
				>
					<div className="keeper-layout" style={{ ...styles.scrollContent }}>
						{results.map((item, index) => {
							const isSelected = index === selectedIndex;
							const label =
								item.type === "create" ? `Create "${item.title}"` : item.title;
							return (
								<button
									type="button"
									className="keeper-control"
									key={item.id}
									onClick={() => onSelect(item)}
									style={{
										...styles.item,
										...(isSelected ? styles.itemSelected : {}),
									}}
								>
									<span
										className="keeper-copy"
										style={{
											...styles.itemText,
											...(isSelected ? styles.itemTextSelected : {}),
										}}
									>
										{label}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}

function createStyles(theme: ExtendedTheme) {
	return {
		container: {
			boxShadow: `0px 2px 8px color-mix(in srgb, ${theme.colors.shadow} ${0.25 * 100}%, transparent)`,
			maxHeight: MAX_HEIGHT,
			backgroundColor: theme.colors.card,
			borderRadius: 8,
			overflow: "hidden",
		},
		scrollView: { flexGrow: 0 },
		scrollContent: { paddingTop: 4, paddingBottom: 4 },
		item: {
			height: ITEM_HEIGHT,
			paddingLeft: 12,
			paddingRight: 12,
			justifyContent: "center",
			minHeight: ITEM_HEIGHT,
		},
		itemSelected: { backgroundColor: theme.colors.primary },

		itemText: {
			fontSize: theme.typography.body.fontSize || 16,
			color: theme.colors.text,
		},
		itemTextSelected: {
			color: theme.colors.primaryContrast,
			fontWeight: "600",
		},
		loadingContainer: {
			height: ITEM_HEIGHT,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			paddingLeft: 12,
			paddingRight: 12,
			gap: 8,
		},
		loadingText: {
			fontSize: theme.typography.body.fontSize || 16,
			color: theme.colors.text,
			opacity: 0.6,
		},
	} satisfies Record<string, React.CSSProperties>;
}
