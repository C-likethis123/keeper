import {
	type BlockConfig,
	blockRegistry,
} from "@/components/editor/blocks/BlockRegistry";
import { BlockType } from "@/components/editor/core/BlockNode";
import { getListItemNumber } from "@/components/editor/core/Document";
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { useEditorBlock, useEditorState } from "@/stores/editorStore";
import { FontAwesome6 } from "@expo/vector-icons";
import React, { useState } from "react";
import {
	type GestureResponderEvent,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";

interface BlockRowHandlers {
	onContentChange: (index: number, content: string) => void;
	onBlockTypeChange?: (
		index: number,
		newType: BlockType,
		language?: string,
	) => void;
	onAttributesChange?: (
		index: number,
		newAttributes: Record<string, unknown>,
	) => void;
	onBackspaceAtStart: (index: number) => void;
	onSpace: (index: number, cursorOffset: number) => boolean;
	onEnter: (index: number, cursorOffset: number) => void;
	onBlockExit?: (index: number) => void;
	onSelectionChange: (index: number, start: number, end: number) => void;
	onDelete: (index: number) => void;
	onCheckboxToggle: (index: number) => void;
	onOpenWikiLink: (title: string) => void;
	onSelectBlock: (index: number) => void;
	onSelectBlockRange: (index: number) => void;
	onClearStructuredSelection: () => void;
	onDragStart: (index: number, initialY: number) => void;
	onDragUpdate: (pageY: number) => void;
	onDragEnd: () => void;
	onLayout: (index: number, y: number, height: number) => void;
}

interface BlockRowProps {
	index: number;
	handlers: BlockRowHandlers;
	activeDragIndex: Animated.SharedValue<number | null>;
	dropIndex: Animated.SharedValue<number | null>;
	draggedBlockHeight: Animated.SharedValue<number>;
	dragAbsoluteY: Animated.SharedValue<number>;
	dragStartY: Animated.SharedValue<number>;
}

export const BlockRow = React.memo(function BlockRow({
	index,
	handlers,
	activeDragIndex,
	dropIndex,
	draggedBlockHeight,
	dragAbsoluteY,
	dragStartY,
}: BlockRowProps) {
	const theme = useExtendedTheme();
	const styles = useStyles(makeStyles);
	const block = useEditorBlock(index);
	const isFocused = useEditorState(
		(s) => (s.selection?.focus.blockIndex ?? null) === index,
	);
	const hasBlockSelection = useEditorState((s) => {
		const selection = s.blockSelection;
		return (
			selection != null && index >= selection.start && index <= selection.end
		);
	});
	const isGapSelected = useEditorState((s) => s.gapSelection?.index === index);
	const listItemNumber = useEditorState((s) => {
		const b = s.document.blocks[index];
		return b?.type === BlockType.numberedList
			? getListItemNumber(s.document, index)
			: undefined;
	});

	const [isRowHovered, setIsRowHovered] = useState(false);

	const animatedStyle = useAnimatedStyle(() => {
		const isActive = activeDragIndex.value === index;
		const currentDropIndex = dropIndex.value;
		const shiftHeight = draggedBlockHeight.value;

		if (isActive) {
			return {
				transform: [
					{ translateY: dragAbsoluteY.value - dragStartY.value },
					{ scale: withSpring(1.02) },
				],
				zIndex: 1000,
				shadowOpacity: withSpring(0.2),
				backgroundColor: theme.colors.background,
			};
		}

		let translateY = 0;
		if (activeDragIndex.value !== null && currentDropIndex !== null) {
			// Shifting logic
			if (index > activeDragIndex.value && index <= currentDropIndex) {
				// Shifting up to make room below
				translateY = -shiftHeight;
			} else if (index < activeDragIndex.value && index >= currentDropIndex) {
				// Shifting down to make room above
				translateY = shiftHeight;
			}
		}

		return {
			transform: [{ translateY: withSpring(translateY) }],
			zIndex: 1,
			shadowOpacity: 0,
		};
	}, [index, theme]);
	const isActive = activeDragIndex.value === index;

	if (!block) {
		return null;
	}

	const config: BlockConfig = {
		block,
		index,
		isFocused,
		hasBlockSelection,
		isGapSelected,
		onContentChange: handlers.onContentChange,
		onBlockTypeChange: handlers.onBlockTypeChange,
		onAttributesChange: handlers.onAttributesChange,
		onBackspaceAtStart: handlers.onBackspaceAtStart,
		onEnter: handlers.onEnter,
		onSelectionChange: handlers.onSelectionChange,
		onBlockExit: handlers.onBlockExit,
		onDelete: handlers.onDelete,
		listItemNumber,
		onCheckboxToggle: handlers.onCheckboxToggle,
		onOpenWikiLink: handlers.onOpenWikiLink,
		clearStructuredSelection: handlers.onClearStructuredSelection,
	};

	// Conditional styles for the sticky behavior on web video blocks
	const stickyStyles =
		Platform.OS === "web" &&
		config.block.type === BlockType.video &&
		!isActive // Only apply sticky if not actively being dragged
			? {
					position: "sticky",
					top: 0,
					zIndex: 20, // Ensure it stays above other blocks when sticky
				}
			: {};

	const handleGutterPress = (event: GestureResponderEvent) => {
		const nativeEvent =
			event.nativeEvent as GestureResponderEvent["nativeEvent"] & {
				shiftKey?: boolean;
			};
		if (nativeEvent.shiftKey) {
			handlers.onSelectBlockRange(index);
			return;
		}
		handlers.onSelectBlock(index);
	};

	const panGesture = Gesture.Pan()
		.onStart((e) => {
			handlers.onDragStart(index, e.absoluteY);
		})
		.onUpdate((e) => {
			handlers.onDragUpdate(e.absoluteY);
		})
		.onEnd(() => {
			handlers.onDragEnd();
		});

	const showRowChrome =
		Platform.OS === "web"
			? isRowHovered || hasBlockSelection
			: isFocused || hasBlockSelection;

	return (
		<Animated.View
			style={[styles.blockWrapper, animatedStyle, stickyStyles]} // Apply stickyStyles here
			collapsable={false}
			onPointerEnter={() => setIsRowHovered(true)}
			onPointerLeave={() => setIsRowHovered(false)}
			onLayout={(e) => {
				handlers.onLayout(
					index,
					e.nativeEvent.layout.y,
					e.nativeEvent.layout.height,
				);
			}}
		>
			<View
				style={[
					styles.rowShell,
					hasBlockSelection && styles.rowShellSelected,
					{
						// Remove sticky styles from here, make it relative
						position: "relative",
						// zIndex: config.block.type === BlockType.video ? 1 : 1, // Keep default zIndex if not sticky
						top: undefined,
					},
				]}
			>
				<View style={styles.leftRail}>
					<GestureDetector gesture={panGesture}>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`Select block ${index + 1}`}
							testID={`block-gutter-${index}`}
							style={[
								styles.chromeButton,
								showRowChrome && styles.chromeButtonVisible,
								styles.dragHandle,
								hasBlockSelection && {
									backgroundColor: theme.colors.primary,
									borderColor: theme.colors.primary,
								},
							]}
							onPress={handleGutterPress}
						>
							<FontAwesome6 name="grip-vertical" style={styles.dragHandleDot} />
						</Pressable>
					</GestureDetector>
				</View>
				<View style={styles.blockContent}>{blockRegistry.build(config)}</View>
			</View>
		</Animated.View>
	);
});

function makeStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		blockWrapper: {
			width: "100%",
		},
		rowShell: {
			flexDirection: "row",
			alignItems: "stretch",
			borderRadius: 10,
			borderWidth: 1,
			borderColor: "transparent",
			backgroundColor: "transparent",
		},
		rowShellSelected: {
			backgroundColor: theme.custom.editor.blockFocused,
			borderColor: theme.colors.primary,
		},
		leftRail: {
			width: 40,
			paddingLeft: 6,
			paddingRight: 4,
			paddingVertical: 6,
			alignItems: "center",
			justifyContent: "center",
			gap: 6,
		},
		chromeButton: {
			width: 24,
			height: 24,
			borderRadius: 8,
			borderWidth: 1,
			borderColor: "transparent",
			backgroundColor: "transparent",
			alignItems: "center",
			justifyContent: "center",
			opacity: 0,
		},
		chromeButtonVisible: {
			opacity: 1,
			backgroundColor: theme.colors.background,
			shadowColor: theme.colors.shadow,
			shadowOpacity: 0.08,
			shadowRadius: 6,
			shadowOffset: { width: 0, height: 2 },
			elevation: 1,
		},
		chromeButtonText: {
			color: theme.colors.textMuted,
			fontSize: 16,
			fontWeight: "600",
			lineHeight: 18,
		},
		dragHandle: {
			cursor: Platform.OS === "web" ? ("grab" as const) : undefined,
		},
		dragHandleDots: {
			width: 10,
			flexDirection: "row",
			flexWrap: "wrap",
			justifyContent: "space-between",
			rowGap: 2,
		},
		dragHandleDot: {
			color: theme.colors.textMuted,
		},
		dragHandleDotSelected: {
			backgroundColor: theme.colors.primaryContrast,
		},
		blockContent: {
			flex: 1,
			minWidth: 0,
		},
	});
}
