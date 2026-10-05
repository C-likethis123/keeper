import type React from "react";
import "@/components/shared/shared.css";
import type {
	DrawingBackgroundPattern,
	DrawingTool,
} from "@/components/drawing/drawingDocument";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@/components/shared/Icons";
import { memo, useCallback } from "react";
import { useSafeAreaInsets } from "@/components/shared/SafeArea";

const COLORS = [
	"#202124",
	"#d93025",
	"#f9ab00",
	"#188038",
	"#1a73e8",
	"#a142f4",
];
const WIDTHS = [4, 10, 20];
const TOOLS: Array<{
	value: DrawingTool | "eraser";
	label: string;
	icon: React.ComponentProps<typeof FontAwesome>["name"];
}> = [
	{ value: "pen", label: "Pen", icon: "pencil" },
	{ value: "marker", label: "Marker", icon: "paint-brush" },
	{ value: "highlighter", label: "Highlighter", icon: "square" },
	{ value: "eraser", label: "Eraser", icon: "eraser" },
];

interface Props {
	tool: DrawingTool | "eraser";
	color: string;
	strokeWidth: number;
	backgroundPattern: DrawingBackgroundPattern;
	canUndo: boolean;
	canRedo: boolean;
	onToolChange: (tool: DrawingTool | "eraser") => void;
	onColorChange: (color: string) => void;
	onWidthChange: (width: number) => void;
	onCycleBackground: () => void;
	onUndo: () => void;
	onRedo: () => void;
}

function DrawingToolbar({
	tool,
	color,
	strokeWidth,
	backgroundPattern,
	canUndo,
	canRedo,
	onToolChange,
	onColorChange,
	onWidthChange,
	onCycleBackground,
	onUndo,
	onRedo,
}: Props) {
	const insets = useSafeAreaInsets();
	const theme = useExtendedTheme();
	const styles = useStyles(createStyles);
	const handleUndo = useCallback(() => onUndo(), [onUndo]);
	const handleRedo = useCallback(() => onRedo(), [onRedo]);

	return (
		<div
			className="keeper-layout"
			style={{
				...styles.shell,
				...{ paddingBottom: Math.max(insets.bottom, 8) },
			}}
		>
			<div className="keeper-layout" style={{ overflowX: "auto", ...{} }}>
				<div
					className="keeper-layout"
					style={{ flexDirection: "row", ...styles.content }}
				>
					<button
						type="button"
						className="keeper-control"
						onClick={handleUndo}
						disabled={!canUndo}
						style={{
							...styles.iconButton,
							...(!canUndo ? styles.disabled : {}),
						}}
						aria-label="Undo"
					>
						<FontAwesome name="undo" size={18} color={theme.colors.text} />
					</button>
					<button
						type="button"
						className="keeper-control"
						onClick={handleRedo}
						disabled={!canRedo}
						style={{
							...styles.iconButton,
							...(!canRedo ? styles.disabled : {}),
						}}
						aria-label="Redo"
					>
						<FontAwesome name="repeat" size={18} color={theme.colors.text} />
					</button>
					<div className="keeper-layout" style={styles.divider} />
					{TOOLS.map((option) => {
						const selected = option.value === tool;
						return (
							<button
								type="button"
								className="keeper-control"
								key={option.value}
								onClick={() => onToolChange(option.value)}
								style={{
									...styles.toolButton,
									...(selected ? styles.selectedButton : {}),
								}}
								aria-label={option.label}
								aria-pressed={true}
							>
								<FontAwesome
									name={option.icon}
									size={17}
									color={
										selected ? theme.colors.primaryContrast : theme.colors.text
									}
								/>
								<span
									className="keeper-copy"
									style={{
										...styles.toolLabel,
										...(selected ? styles.selectedLabel : {}),
									}}
								>
									{option.label}
								</span>
							</button>
						);
					})}
					<div className="keeper-layout" style={styles.divider} />
					{COLORS.map((option) => {
						const selected = option === color;
						return (
							<button
								type="button"
								className="keeper-control"
								key={option}
								onClick={() => onColorChange(option)}
								style={{
									...styles.colorButton,
									...{ backgroundColor: option },
									...(selected ? styles.selectedColor : {}),
								}}
								aria-label={`Color ${option}`}
								aria-pressed={true}
							/>
						);
					})}
					<div className="keeper-layout" style={styles.divider} />
					{WIDTHS.map((option) => {
						const selected = option === strokeWidth;
						return (
							<button
								type="button"
								className="keeper-control"
								key={option}
								onClick={() => onWidthChange(option)}
								style={{
									...styles.widthButton,
									...(selected ? styles.selectedWidth : {}),
								}}
								aria-label={`Stroke width ${option}`}
								aria-pressed={true}
							>
								<div
									className="keeper-layout"
									style={{
										...styles.widthDot,
										...{
											width: Math.max(4, option / 2),
											height: Math.max(4, option / 2),
										},
									}}
								/>
							</button>
						);
					})}
					<button
						type="button"
						className="keeper-control"
						onClick={onCycleBackground}
						style={styles.backgroundButton}
						aria-label={`Background ${backgroundPattern}`}
					>
						<FontAwesome name="th" size={17} color={theme.colors.text} />
						<span className="keeper-copy" style={styles.toolLabel}>
							{backgroundPattern}
						</span>
					</button>
				</div>
			</div>
		</div>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return {
		shell: {
			backgroundColor: theme.colors.card,
			borderTopWidth: 1,
			borderTopColor: theme.colors.border,
			paddingTop: 8,
		},
		content: {
			alignItems: "center",
			gap: 8,
			paddingLeft: 12,
			paddingRight: 12,
		},
		iconButton: {
			width: 40,
			height: 40,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 12,
		},
		disabled: { opacity: 0.3 },
		divider: { width: 1, height: 28, backgroundColor: theme.colors.border },
		toolButton: {
			height: 40,
			paddingLeft: 10,
			paddingRight: 10,
			borderRadius: 12,
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
		},
		selectedButton: { backgroundColor: theme.colors.primary },
		toolLabel: {
			color: theme.colors.text,
			fontSize: 12,
			textTransform: "capitalize",
		},
		selectedLabel: { color: theme.colors.primaryContrast },
		colorButton: { width: 30, height: 30, borderRadius: 15 },
		selectedColor: { borderWidth: 3, borderColor: theme.colors.primary },
		widthButton: {
			width: 34,
			height: 34,
			borderRadius: 17,
			alignItems: "center",
			justifyContent: "center",
		},
		selectedWidth: { backgroundColor: theme.colors.border },
		widthDot: { borderRadius: 999, backgroundColor: theme.colors.text },
		backgroundButton: {
			height: 40,
			paddingLeft: 10,
			paddingRight: 10,
			borderRadius: 12,
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
		},
	} satisfies Record<string, React.CSSProperties>;
}

export default memo(DrawingToolbar);
