import {
	createDrawingStroke,
	createEmptyDrawingDocument,
	serializeDrawingDocument,
} from "@keeper/components/drawing/drawingDocument";
import { render } from "@testing-library/react";
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
