import type {
	DrawingBackgroundPattern,
	DrawingTool,
} from "@/components/drawing/drawingDocument";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { FontAwesome } from "@expo/vector-icons";
import { memo, useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
		<View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 8) }]}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.content}
			>
				<Pressable
					onPress={handleUndo}
					disabled={!canUndo}
					style={[styles.iconButton, !canUndo && styles.disabled]}
					accessibilityRole="button"
					accessibilityLabel="Undo"
				>
					<FontAwesome name="undo" size={18} color={theme.colors.text} />
				</Pressable>
				<Pressable
					onPress={handleRedo}
					disabled={!canRedo}
					style={[styles.iconButton, !canRedo && styles.disabled]}
					accessibilityRole="button"
					accessibilityLabel="Redo"
				>
					<FontAwesome name="repeat" size={18} color={theme.colors.text} />
				</Pressable>
				<View style={styles.divider} />
				{TOOLS.map((option) => {
					const selected = option.value === tool;
					return (
						<Pressable
							key={option.value}
							onPress={() => onToolChange(option.value)}
							style={[styles.toolButton, selected && styles.selectedButton]}
							accessibilityRole="button"
							accessibilityLabel={option.label}
							accessibilityState={{ selected }}
						>
							<FontAwesome
								name={option.icon}
								size={17}
								color={
									selected ? theme.colors.primaryContrast : theme.colors.text
								}
							/>
							<Text
								style={[styles.toolLabel, selected && styles.selectedLabel]}
							>
								{option.label}
							</Text>
						</Pressable>
					);
				})}
				<View style={styles.divider} />
				{COLORS.map((option) => {
					const selected = option === color;
					return (
						<Pressable
							key={option}
							onPress={() => onColorChange(option)}
							style={[
								styles.colorButton,
								{ backgroundColor: option },
								selected && styles.selectedColor,
							]}
							accessibilityRole="button"
							accessibilityLabel={`Color ${option}`}
							accessibilityState={{ selected }}
						/>
					);
				})}
				<View style={styles.divider} />
				{WIDTHS.map((option) => {
					const selected = option === strokeWidth;
					return (
						<Pressable
							key={option}
							onPress={() => onWidthChange(option)}
							style={[styles.widthButton, selected && styles.selectedWidth]}
							accessibilityRole="button"
							accessibilityLabel={`Stroke width ${option}`}
							accessibilityState={{ selected }}
						>
							<View
								style={[
									styles.widthDot,
									{
										width: Math.max(4, option / 2),
										height: Math.max(4, option / 2),
									},
								]}
							/>
						</Pressable>
					);
				})}
				<Pressable
					onPress={onCycleBackground}
					style={styles.backgroundButton}
					accessibilityRole="button"
					accessibilityLabel={`Background ${backgroundPattern}`}
				>
					<FontAwesome name="th" size={17} color={theme.colors.text} />
					<Text style={styles.toolLabel}>{backgroundPattern}</Text>
				</Pressable>
			</ScrollView>
		</View>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		shell: {
			backgroundColor: theme.colors.card,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.colors.border,
			paddingTop: 8,
		},
		content: {
			alignItems: "center",
			gap: 8,
			paddingHorizontal: 12,
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
			paddingHorizontal: 10,
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
			paddingHorizontal: 10,
			borderRadius: 12,
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
		},
	});
}

export default memo(DrawingToolbar);
