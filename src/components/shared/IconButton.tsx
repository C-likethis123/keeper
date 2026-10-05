import "./shared.css";
import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@/components/shared/Icons";
import React from "react";

type FontAwesomeName = React.ComponentProps<typeof FontAwesome>["name"];

export function IconButton({
	name,
	size = 22,
	onPress,
	disabled = false,
	testID,
	variant = "circle",
	label,
	tooltipAlignment = "center",
	tooltipPlacement = "top",
}: {
	name: FontAwesomeName;
	size?: number;
	onPress: () => void;
	disabled?: boolean;
	testID?: string;
	variant?: "circle" | "flat";
	label?: string;
	tooltipAlignment?: "start" | "center" | "end";
	tooltipPlacement?: "top" | "bottom";
}) {
	const styles = useStyles(createStyles);
	const [isHovered, setIsHovered] = React.useState(false);

	const showTooltip = variant === "flat" && isHovered && label != null;

	return (
		<div
			style={
				variant === "flat"
					? {
							...styles.wrapperFlat,
							...(showTooltip ? styles.wrapperFlatRaised : {}),
						}
					: undefined
			}
		>
			<button
				type="button"
				className={
					variant === "flat"
						? "keeper-control keeper-icon-flat"
						: "keeper-control"
				}
				aria-label={label ?? name}
				style={{
					...(variant === "circle"
						? { ...styles.buttonCircle }
						: { ...styles.buttonFlat }),
				}}
				onClick={onPress}
				disabled={disabled}
				data-testid={testID}
				onPointerEnter={
					variant === "flat" ? () => setIsHovered(true) : undefined
				}
				onPointerLeave={
					variant === "flat" ? () => setIsHovered(false) : undefined
				}
				onFocus={variant === "flat" ? () => setIsHovered(true) : undefined}
				onBlur={variant === "flat" ? () => setIsHovered(false) : undefined}
			>
				<FontAwesome
					name={name}
					size={size}
					style={
						variant === "circle"
							? { ...styles.icon, ...(disabled ? styles.iconDisabled : {}) }
							: { ...styles.iconFlat, ...(disabled ? styles.iconDisabled : {}) }
					}
				/>
			</button>
			{showTooltip ? (
				<div
					data-testid={testID ? `${testID}-tooltip` : undefined}
					role="tooltip"
					style={{
						pointerEvents: "none",
						whiteSpace: "nowrap",
						...styles.tooltip,
						...(tooltipPlacement === "top"
							? styles.tooltipTop
							: styles.tooltipBottom),
						...(tooltipAlignment === "start" ? styles.tooltipStart : {}),
						...(tooltipAlignment === "end" ? styles.tooltipEnd : {}),
					}}
				>
					<span style={styles.tooltipText}>{label}</span>
				</div>
			) : null}
		</div>
	);
}

function createStyles(theme: ExtendedTheme) {
	return {
		wrapperFlat: {
			display: "flex",
			flexDirection: "column",
			position: "relative",
			alignItems: "center",
			justifyContent: "center",
		},
		wrapperFlatRaised: {
			zIndex: 1,
		},
		buttonCircle: {
			display: "flex",
			flexDirection: "column",
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: theme.colors.background,
			justifyContent: "center" as const,
			alignItems: "center" as const,
			borderWidth: 1,
			borderStyle: "solid",
			borderColor: theme.colors.border,
		},
		buttonFlat: {
			display: "flex",
			flexDirection: "column",
			paddingTop: 2,
			paddingBottom: 2,
		},
		icon: {
			color: theme.colors.text,
		},
		iconFlat: {
			color: theme.colors.textMuted,
		},
		iconDisabled: {
			color: theme.colors.textDisabled,
		},
		tooltip: {
			boxShadow: `0 4px 8px ${theme.colors.shadow}`,
			position: "absolute",
			paddingLeft: 8,
			paddingRight: 8,
			paddingTop: 6,
			paddingBottom: 6,
			borderRadius: 8,
			backgroundColor: theme.colors.text,
			zIndex: 10,
		},
		tooltipTop: {
			bottom: "100%",
			marginBottom: 8,
		},
		tooltipBottom: {
			top: "100%",
			marginTop: 8,
		},
		tooltipStart: {
			left: 0,
		},
		tooltipEnd: {
			right: 0,
		},
		tooltipText: {
			fontSize: 12,
			fontWeight: "500",
			color: theme.colors.card,
		},
	} satisfies Record<string, React.CSSProperties>;
}
