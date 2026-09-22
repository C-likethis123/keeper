import {
	createDrawingStroke,
	createEmptyDrawingDocument,
	serializeDrawingDocument,
} from "@keeper/components/drawing/drawingDocument";
import { render } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { BrowserDrawingEditor } from "./BrowserDrawingEditor";

it("loads a restored drawing document into the browser canvas", () => {
	const empty = serializeDrawingDocument(createEmptyDrawingDocument());
	const restored = createEmptyDrawingDocument();
	restored.strokes.push(
		createDrawingStroke({
			tool: "pen",
			color: "#202124",
			width: 4,
			points: [
				{ x: 8, y: 8 },
				{ x: 48, y: 48 },
			],
		}),
	);
	const { container, rerender } = render(
		<BrowserDrawingEditor value={empty} onChange={() => undefined} />,
	);

	expect(container.querySelectorAll("svg path")).toHaveLength(0);

	rerender(
		<BrowserDrawingEditor
			value={serializeDrawingDocument(restored)}
			onChange={() => undefined}
		/>,
	);

	expect(container.querySelectorAll("svg path")).toHaveLength(1);
});

it("keeps a live stroke separate until pointer release", () => {
	const onChange = vi.fn();
	const { container } = render(
		<BrowserDrawingEditor value="" onChange={onChange} />,
	);
	const canvas = container.querySelector("svg") as SVGSVGElement;
	Object.defineProperty(canvas, "getBoundingClientRect", {
		value: () => ({ left: 0, top: 0, width: 100, height: 100 }),
	});
	Object.defineProperty(canvas, "setPointerCapture", {
		value: () => undefined,
	});

	fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
	fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 20, clientY: 20 });
	expect(container.querySelectorAll("svg path")).toHaveLength(1);
	expect(onChange).not.toHaveBeenCalled();

	fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 20, clientY: 20 });
	expect(onChange).toHaveBeenCalledTimes(1);
	const saved = JSON.parse(onChange.mock.calls[0][0]) as {
		strokes: Array<{ points: Array<{ x: number; y: number }> }>;
	};
	expect(saved.strokes[0].points).toEqual([
		{ x: 102.4, y: 76.80000000000001 },
		{ x: 204.8, y: 153.60000000000002 },
	]);
});
