import {
	type DrawingDocument,
	type DrawingPoint,
	type DrawingStroke,
	type DrawingTool,
	appendPoint,
	createDrawingStroke,
	findStrokeAtPoint,
	pointsToSvgPath,
} from "@/components/drawing/drawingDocument";
import {
	Canvas,
	Circle,
	Fill,
	Group,
	Line,
	Path,
	vec,
} from "@shopify/react-native-skia";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

export interface DrawingCanvasProps {
	document: DrawingDocument;
	tool: DrawingTool | "eraser";
	color: string;
	strokeWidth: number;
	onChange: (document: DrawingDocument) => void;
}

const PATTERN_SPACING = 64;
const VERTICAL_GRID_POSITIONS = Array.from(
	{ length: 15 },
	(_, index) => (index + 1) * PATTERN_SPACING,
);
const HORIZONTAL_GRID_POSITIONS = Array.from(
	{ length: 11 },
	(_, index) => (index + 1) * PATTERN_SPACING,
);
const DOT_POSITIONS = HORIZONTAL_GRID_POSITIONS.flatMap((y) =>
	VERTICAL_GRID_POSITIONS.map((x) => ({ x, y, key: `${x}-${y}` })),
);

function DrawingCanvas({
	document,
	tool,
	color,
	strokeWidth,
	onChange,
}: DrawingCanvasProps) {
	const [activeStroke, setActiveStroke] = useState<DrawingStroke | null>(null);
	const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
	const sizeRef = useRef({ width: 1, height: 1 });
	const activeStrokeRef = useRef<DrawingStroke | null>(null);
	const documentRef = useRef(document);
	documentRef.current = document;

	const toDocumentPoint = useCallback((x: number, y: number): DrawingPoint => {
		const size = sizeRef.current;
		return {
			x: Math.max(
				0,
				Math.min(
					documentRef.current.width,
					(x / size.width) * documentRef.current.width,
				),
			),
			y: Math.max(
				0,
				Math.min(
					documentRef.current.height,
					(y / size.height) * documentRef.current.height,
				),
			),
		};
	}, []);

	const eraseAt = useCallback(
		(point: DrawingPoint) => {
			const current = documentRef.current;
			const strokeId = findStrokeAtPoint(current.strokes, point, 18);
			if (!strokeId) return;
			const next = {
				...current,
				strokes: current.strokes.filter((stroke) => stroke.id !== strokeId),
			};
			documentRef.current = next;
			onChange(next);
		},
		[onChange],
	);

	const beginStroke = useCallback(
		(x: number, y: number) => {
			const point = toDocumentPoint(x, y);
			if (tool === "eraser") {
				eraseAt(point);
				return;
			}
			const next = createDrawingStroke({
				tool,
				color,
				width: strokeWidth,
				points: [point],
			});
			activeStrokeRef.current = next;
			setActiveStroke(next);
		},
		[color, eraseAt, strokeWidth, toDocumentPoint, tool],
	);

	const continueStroke = useCallback(
		(x: number, y: number) => {
			const point = toDocumentPoint(x, y);
			if (tool === "eraser") {
				eraseAt(point);
				return;
			}
			const current = activeStrokeRef.current;
			if (!current) return;
			const points = appendPoint(current.points, point);
			if (points === current.points) return;
			const next = { ...current, points };
			activeStrokeRef.current = next;
			setActiveStroke(next);
		},
		[eraseAt, toDocumentPoint, tool],
	);

	const endStroke = useCallback(() => {
		const stroke = activeStrokeRef.current;
		activeStrokeRef.current = null;
		setActiveStroke(null);
		if (!stroke) return;
		const current = documentRef.current;
		const next = { ...current, strokes: [...current.strokes, stroke] };
		documentRef.current = next;
		onChange(next);
	}, [onChange]);

	const gesture = useMemo(
		() =>
			Gesture.Pan()
				.minDistance(0)
				.runOnJS(true)
				.onBegin((event) => beginStroke(event.x, event.y))
				.onUpdate((event) => continueStroke(event.x, event.y))
				.onFinalize(endStroke),
		[beginStroke, continueStroke, endStroke],
	);

	const handleLayout = useCallback((event: LayoutChangeEvent) => {
		const next = {
			width: Math.max(1, event.nativeEvent.layout.width),
			height: Math.max(1, event.nativeEvent.layout.height),
		};
		sizeRef.current = next;
		setCanvasSize(next);
	}, []);

	const visibleStrokes = activeStroke
		? [...document.strokes, activeStroke]
		: document.strokes;
	const documentTransform = useMemo(
		() => [
			{ scaleX: canvasSize.width / document.width },
			{ scaleY: canvasSize.height / document.height },
		],
		[canvasSize.height, canvasSize.width, document.height, document.width],
	);

	return (
		<View style={styles.container} onLayout={handleLayout}>
			<GestureDetector gesture={gesture}>
				<Canvas style={styles.canvas} accessibilityLabel="Drawing canvas">
					<Fill color={document.background.color} />
					<Group transform={documentTransform}>
						{document.background.pattern === "grid"
							? VERTICAL_GRID_POSITIONS.map((x) => (
									<Line
										key={`vertical-${x}`}
										p1={vec(x, 0)}
										p2={vec(x, document.height)}
										color="#d5d9df"
										strokeWidth={2}
									/>
								))
							: null}
						{document.background.pattern === "grid" ||
						document.background.pattern === "ruled"
							? HORIZONTAL_GRID_POSITIONS.map((y) => (
									<Line
										key={`horizontal-${y}`}
										p1={vec(0, y)}
										p2={vec(document.width, y)}
										color="#d5d9df"
										strokeWidth={2}
									/>
								))
							: null}
						{document.background.pattern === "dots"
							? DOT_POSITIONS.map((point) => (
									<Circle
										key={point.key}
										cx={point.x}
										cy={point.y}
										r={3}
										color="#d5d9df"
									/>
								))
							: null}
						{visibleStrokes.map((stroke) => (
							<Path
								key={stroke.id}
								path={pointsToSvgPath(stroke.points)}
								style="stroke"
								color={stroke.color}
								opacity={stroke.opacity}
								strokeWidth={stroke.width}
								strokeCap="round"
								strokeJoin="round"
							/>
						))}
					</Group>
				</Canvas>
			</GestureDetector>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, overflow: "hidden" },
	canvas: { flex: 1 },
});

export default memo(DrawingCanvas);
