import "@/components/shared/shared.css";
import Loader from "@/components/shared/Loader";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import type React from "react";

export interface SlashCommandItem {
	id: string;
	title: string;
	description: string;
	keywords: string[];
}

interface SlashCommandOverlayProps {
	results: SlashCommandItem[];
	selectedIndex: number;
	isLoading?: boolean;
	onSelect: (item: SlashCommandItem) => void;
}

const MAX_HEIGHT = 200;
const ITEM_HEIGHT = 48;

export function SlashCommandOverlay({
	results,
	selectedIndex,
	isLoading = false,
	onSelect,
}: SlashCommandOverlayProps) {
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
										{item.title}
									</span>
									<span
										className="keeper-copy"
										style={{
											...styles.itemDescription,
											...(isSelected ? styles.itemDescriptionSelected : {}),
										}}
									>
										{item.description}
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
			minHeight: ITEM_HEIGHT,
			paddingLeft: 12,
			paddingRight: 12,
			paddingTop: 8,
			paddingBottom: 8,
			justifyContent: "center",
		},
		itemSelected: { backgroundColor: theme.colors.primary },

		itemText: {
			fontSize: theme.typography.body.fontSize || 16,
			color: theme.colors.text,
			fontWeight: "600",
		},
		itemTextSelected: { color: theme.colors.primaryContrast },
		itemDescription: {
			fontSize: 13,
			color: theme.colors.textMuted,
			marginTop: 2,
		},
		itemDescriptionSelected: {
			color: theme.colors.primaryContrast,
			opacity: 0.85,
		},
	} satisfies Record<string, React.CSSProperties>;
}
