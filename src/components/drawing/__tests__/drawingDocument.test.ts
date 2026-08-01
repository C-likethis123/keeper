import {
	appendPoint,
	createDrawingStroke,
	createEmptyDrawingDocument,
	findStrokeAtPoint,
	parseDrawingDocument,
	pointsToSvgPath,
	serializeDrawingDocument,
} from "../drawingDocument";

describe("drawingDocument", () => {
	it("round-trips valid drawing data", () => {
		const document = createEmptyDrawingDocument();
		document.background.pattern = "grid";
		document.strokes.push(
			createDrawingStroke({
				tool: "highlighter",
				color: "#f9ab00",
				width: 20,
				points: [
					{ x: 10, y: 20 },
					{ x: 40, y: 60, pressure: 0.7 },
				],
			}),
		);

		expect(parseDrawingDocument(serializeDrawingDocument(document))).toEqual(
			document,
		);
	});

	it("returns empty drawing for missing or corrupt data", () => {
		expect(parseDrawingDocument("")).toEqual(createEmptyDrawingDocument());
		expect(parseDrawingDocument("not-json")).toEqual(
			createEmptyDrawingDocument(),
		);
		expect(parseDrawingDocument('{"version":999}')).toEqual(
			createEmptyDrawingDocument(),
		);
	});

	it("decimates points close to previous point", () => {
		const points = [{ x: 0, y: 0 }];
		expect(appendPoint(points, { x: 1, y: 1 })).toBe(points);
		expect(appendPoint(points, { x: 3, y: 4 })).toEqual([
			{ x: 0, y: 0 },
			{ x: 3, y: 4 },
		]);
	});

	it("creates smooth SVG path", () => {
		expect(
			pointsToSvgPath([
				{ x: 0, y: 0 },
				{ x: 10, y: 10 },
				{ x: 20, y: 0 },
			]),
		).toBe("M 0 0 Q 10 10 15 5 L 20 0");
	});

	it("finds topmost stroke within eraser tolerance", () => {
		const lower = createDrawingStroke({
			tool: "pen",
			color: "#000000",
			width: 4,
			points: [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
			],
		});
		const upper = createDrawingStroke({
			tool: "marker",
			color: "#ff0000",
			width: 10,
			points: [
				{ x: 0, y: 4 },
				{ x: 100, y: 4 },
			],
		});

		expect(findStrokeAtPoint([lower, upper], { x: 50, y: 2 }, 2)).toBe(
			upper.id,
		);
		expect(findStrokeAtPoint([lower, upper], { x: 50, y: 100 }, 2)).toBeNull();
	});
});
