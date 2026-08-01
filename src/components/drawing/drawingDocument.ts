export const DRAWING_DOCUMENT_VERSION = 1;
export const DEFAULT_DRAWING_WIDTH = 1024;
export const DEFAULT_DRAWING_HEIGHT = 768;

export type DrawingTool = "pen" | "marker" | "highlighter";
export type DrawingBackgroundPattern = "none" | "grid" | "dots" | "ruled";

export interface DrawingPoint {
	x: number;
	y: number;
	pressure?: number;
}

export interface DrawingStroke {
	id: string;
	tool: DrawingTool;
	color: string;
	width: number;
	opacity: number;
	points: DrawingPoint[];
}

export interface DrawingDocument {
	version: typeof DRAWING_DOCUMENT_VERSION;
	width: number;
	height: number;
	background: {
		color: string;
		pattern: DrawingBackgroundPattern;
	};
	strokes: DrawingStroke[];
}

const DRAWING_TOOLS = new Set<DrawingTool>(["pen", "marker", "highlighter"]);
const DRAWING_PATTERNS = new Set<DrawingBackgroundPattern>([
	"none",
	"grid",
	"dots",
	"ruled",
]);
let strokeIdCounter = 0;

function createStrokeId(): string {
	strokeIdCounter += 1;
	return `stroke-${Date.now().toString(36)}-${strokeIdCounter.toString(36)}`;
}

export function createEmptyDrawingDocument(): DrawingDocument {
	return {
		version: DRAWING_DOCUMENT_VERSION,
		width: DEFAULT_DRAWING_WIDTH,
		height: DEFAULT_DRAWING_HEIGHT,
		background: { color: "#ffffff", pattern: "none" },
		strokes: [],
	};
}

function isFinitePositive(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isDrawingPoint(value: unknown): value is DrawingPoint {
	if (!value || typeof value !== "object") return false;
	const point = value as Partial<DrawingPoint>;
	return (
		typeof point.x === "number" &&
		Number.isFinite(point.x) &&
		typeof point.y === "number" &&
		Number.isFinite(point.y) &&
		(point.pressure === undefined ||
			(typeof point.pressure === "number" && Number.isFinite(point.pressure)))
	);
}

function isDrawingStroke(value: unknown): value is DrawingStroke {
	if (!value || typeof value !== "object") return false;
	const stroke = value as Partial<DrawingStroke>;
	return (
		typeof stroke.id === "string" &&
		DRAWING_TOOLS.has(stroke.tool as DrawingTool) &&
		typeof stroke.color === "string" &&
		isFinitePositive(stroke.width) &&
		typeof stroke.opacity === "number" &&
		stroke.opacity >= 0 &&
		stroke.opacity <= 1 &&
		Array.isArray(stroke.points) &&
		stroke.points.length > 0 &&
		stroke.points.every(isDrawingPoint)
	);
}

export function parseDrawingDocument(content: string): DrawingDocument {
	if (!content.trim()) return createEmptyDrawingDocument();

	try {
		const value = JSON.parse(content) as Partial<DrawingDocument>;
		if (
			value.version !== DRAWING_DOCUMENT_VERSION ||
			!isFinitePositive(value.width) ||
			!isFinitePositive(value.height) ||
			!value.background ||
			typeof value.background.color !== "string" ||
			!DRAWING_PATTERNS.has(value.background.pattern) ||
			!Array.isArray(value.strokes) ||
			!value.strokes.every(isDrawingStroke)
		) {
			return createEmptyDrawingDocument();
		}
		return value as DrawingDocument;
	} catch {
		return createEmptyDrawingDocument();
	}
}

export function serializeDrawingDocument(document: DrawingDocument): string {
	return JSON.stringify(document);
}

export function createDrawingStroke(input: {
	tool: DrawingTool;
	color: string;
	width: number;
	points: DrawingPoint[];
}): DrawingStroke {
	return {
		id: createStrokeId(),
		tool: input.tool,
		color: input.color,
		width: input.width,
		opacity: input.tool === "highlighter" ? 0.3 : 1,
		points: input.points,
	};
}

export function appendPoint(
	points: DrawingPoint[],
	point: DrawingPoint,
	minimumDistance = 2,
): DrawingPoint[] {
	const previous = points.at(-1);
	if (!previous) return [point];
	const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
	return distance < minimumDistance ? points : [...points, point];
}

export function pointsToSvgPath(points: DrawingPoint[]): string {
	if (points.length === 0) return "";
	if (points.length === 1) {
		const point = points[0];
		return `M ${point.x} ${point.y} L ${point.x + 0.01} ${point.y + 0.01}`;
	}

	let path = `M ${points[0].x} ${points[0].y}`;
	for (let index = 1; index < points.length - 1; index += 1) {
		const point = points[index];
		const next = points[index + 1];
		path += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`;
	}
	const last = points.at(-1);
	return last ? `${path} L ${last.x} ${last.y}` : path;
}

function distanceToSegment(
	point: DrawingPoint,
	start: DrawingPoint,
	end: DrawingPoint,
): number {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	if (dx === 0 && dy === 0)
		return Math.hypot(point.x - start.x, point.y - start.y);
	const ratio = Math.max(
		0,
		Math.min(
			1,
			((point.x - start.x) * dx + (point.y - start.y) * dy) /
				(dx * dx + dy * dy),
		),
	);
	const x = start.x + ratio * dx;
	const y = start.y + ratio * dy;
	return Math.hypot(point.x - x, point.y - y);
}

export function findStrokeAtPoint(
	strokes: DrawingStroke[],
	point: DrawingPoint,
	tolerance: number,
): string | null {
	for (
		let strokeIndex = strokes.length - 1;
		strokeIndex >= 0;
		strokeIndex -= 1
	) {
		const stroke = strokes[strokeIndex];
		const threshold = tolerance + stroke.width / 2;
		if (stroke.points.length === 1) {
			if (
				distanceToSegment(point, stroke.points[0], stroke.points[0]) <=
				threshold
			) {
				return stroke.id;
			}
			continue;
		}
		for (
			let pointIndex = 1;
			pointIndex < stroke.points.length;
			pointIndex += 1
		) {
			if (
				distanceToSegment(
					point,
					stroke.points[pointIndex - 1],
					stroke.points[pointIndex],
				) <= threshold
			) {
				return stroke.id;
			}
		}
	}
	return null;
}
