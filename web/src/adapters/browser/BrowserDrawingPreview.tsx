import {
	parseDrawingDocument,
	pointsToSvgPath,
} from "@keeper/components/drawing/drawingDocument";
import { memo, useMemo } from "react";

function BrowserDrawingPreview({ content }: { content: string }) {
	const document = useMemo(() => parseDrawingDocument(content), [content]);
	return (
		<svg
			aria-label="Drawing preview"
			role="img"
			viewBox={`0 0 ${document.width} ${document.height}`}
			style={{ display: "block", width: "100%", aspectRatio: "4 / 3" }}
		>
			<rect
				width={document.width}
				height={document.height}
				fill={document.background.color}
			/>
			{document.strokes.map((stroke) => (
				<path
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
		</svg>
	);
}

export default memo(BrowserDrawingPreview);
