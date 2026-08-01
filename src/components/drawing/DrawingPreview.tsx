import {
	parseDrawingDocument,
	pointsToSvgPath,
} from "@/components/drawing/drawingDocument";
import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

function DrawingPreview({ content }: { content: string }) {
	const document = useMemo(() => parseDrawingDocument(content), [content]);
	const gridLines = useMemo(() => {
		if (document.background.pattern === "none") return [];
		const spacing = 64;
		const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
		if (document.background.pattern === "grid") {
			for (let x = spacing; x < document.width; x += spacing) {
				lines.push({ x1: x, y1: 0, x2: x, y2: document.height });
			}
		}
		if (
			document.background.pattern === "grid" ||
			document.background.pattern === "ruled"
		) {
			for (let y = spacing; y < document.height; y += spacing) {
				lines.push({ x1: 0, y1: y, x2: document.width, y2: y });
			}
		}
		return lines;
	}, [document.background.pattern, document.height, document.width]);

	return (
		<View style={styles.container} accessibilityLabel="Drawing preview">
			<Svg
				width="100%"
				height="100%"
				viewBox={`0 0 ${document.width} ${document.height}`}
			>
				<Rect
					x={0}
					y={0}
					width={document.width}
					height={document.height}
					fill={document.background.color}
				/>
				{gridLines.map((line) => (
					<Line
						key={`${line.x1}-${line.y1}-${line.x2}-${line.y2}`}
						{...line}
						stroke="#d5d9df"
						strokeWidth={2}
					/>
				))}
				{document.background.pattern === "dots"
					? Array.from({ length: 11 * 15 }, (_, index) => {
							const column = index % 15;
							const row = Math.floor(index / 15);
							return (
								<Circle
									key={`${column}-${row}`}
									cx={(column + 1) * 64}
									cy={(row + 1) * 64}
									r={3}
									fill="#d5d9df"
								/>
							);
						})
					: null}
				{document.strokes.map((stroke) => (
					<Path
						key={stroke.id}
						d={pointsToSvgPath(stroke.points)}
						fill="none"
						stroke={stroke.color}
						strokeWidth={stroke.width}
						strokeLinecap="round"
						strokeLinejoin="round"
						opacity={stroke.opacity}
					/>
				))}
			</Svg>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		width: "100%",
		aspectRatio: 4 / 3,
		borderRadius: 8,
		overflow: "hidden",
	},
});

export default memo(DrawingPreview);
