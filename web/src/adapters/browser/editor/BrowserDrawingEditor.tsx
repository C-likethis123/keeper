import DrawingToolbar from "@keeper/components/drawing/DrawingToolbar";
import {
	appendPoint,
	createDrawingStroke,
	parseDrawingDocument,
	pointsToSvgPath,
	serializeDrawingDocument,
	findStrokeAtPoint,
	type DrawingDocument,
	type DrawingTool,
} from "@keeper/components/drawing/drawingDocument";
import { darkTheme } from "@keeper/constants/themes/darkTheme";
import { ThemeProvider } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
	type PointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { DrawingPad } from "@web/ui/DrawingPad";

const patterns = ["none", "grid", "dots", "ruled"] as const;
type Tool = DrawingTool | "eraser";

function backgroundStyle(document: DrawingDocument) {
	const color = document.background.color;
	if (document.background.pattern === "dots")
		return {
			backgroundColor: color,
			backgroundImage: "radial-gradient(#c8c8c8 1px, transparent 1px)",
			backgroundSize: "16px 16px",
		};
	if (document.background.pattern === "grid")
		return {
			backgroundColor: color,
			backgroundImage:
				"linear-gradient(#d7d7d7 1px, transparent 1px), linear-gradient(90deg, #d7d7d7 1px, transparent 1px)",
			backgroundSize: "24px 24px",
		};
	if (document.background.pattern === "ruled")
		return {
			backgroundColor: color,
			backgroundImage:
				"repeating-linear-gradient(to bottom, transparent 0, transparent 27px, #d7d7d7 28px)",
			backgroundSize: "100% 28px",
		};
	return { backgroundColor: color };
}

/** DOM canvas adapter preserving canonical drawing document and toolbar contracts. */
export function BrowserDrawingEditor({
	value,
	onChange,
}: { value: string; onChange: (value: string) => void }) {
	// Vite v1 stored raster PNG data. Preserve it; newly created drawings use
	// the canonical stroke-document format above.
	if (value.startsWith("data:image/"))
		return <DrawingPad value={value} onChange={onChange} />;
	const [document, setDocument] = useState<DrawingDocument>(() =>
		parseDrawingDocument(value),
	);
	const [tool, setTool] = useState<Tool>("pen");
	const [color, setColor] = useState("#202124");
	const [strokeWidth, setStrokeWidth] = useState(4);
	const [undo, setUndo] = useState<DrawingDocument[]>([]);
	const [redo, setRedo] = useState<DrawingDocument[]>([]);
	const active = useRef<ReturnType<typeof createDrawingStroke> | null>(null);
	const apply = useCallback(
		(next: DrawingDocument, record = true) => {
			if (record) {
				setUndo((items) => [...items.slice(-49), document]);
				setRedo([]);
			}
			setDocument(next);
			onChange(serializeDrawingDocument(next));
		},
		[document, onChange],
	);
	function point(event: PointerEvent<SVGSVGElement>) {
		const bounds = event.currentTarget.getBoundingClientRect();
		return {
			x: (event.clientX - bounds.left) * (document.width / bounds.width),
			y: (event.clientY - bounds.top) * (document.height / bounds.height),
			pressure: event.pressure || undefined,
		};
	}
	function start(event: PointerEvent<SVGSVGElement>) {
		event.currentTarget.setPointerCapture(event.pointerId);
		const next = point(event);
		if (tool === "eraser") {
			const id = findStrokeAtPoint(document.strokes, next, strokeWidth);
			if (id)
				apply({
					...document,
					strokes: document.strokes.filter((stroke) => stroke.id !== id),
				});
			return;
		}
		active.current = createDrawingStroke({
			tool,
			color,
			width: strokeWidth,
			points: [next],
		});
	}
	function move(event: PointerEvent<SVGSVGElement>) {
		const stroke = active.current;
		if (!stroke) return;
		active.current = {
			...stroke,
			points: appendPoint(stroke.points, point(event)),
		};
		setDocument((current) => ({
			...current,
			strokes: [...document.strokes, active.current ?? stroke],
		}));
	}
	function end() {
		const stroke = active.current;
		active.current = null;
		if (stroke) apply({ ...document, strokes: [...document.strokes, stroke] });
	}
	function cycleBackground() {
		const current = document.background.pattern;
		const pattern = patterns[(patterns.indexOf(current) + 1) % patterns.length];
		apply({ ...document, background: { ...document.background, pattern } });
	}
	const undoLast = useCallback(() => {
		const previous = undo.at(-1);
		if (!previous) return;
		setRedo((items) => [...items, document]);
		setUndo((items) => items.slice(0, -1));
		apply(previous, false);
	}, [apply, document, undo]);
	const redoLast = useCallback(() => {
		const next = redo.at(-1);
		if (!next) return;
		setUndo((items) => [...items, document]);
		setRedo((items) => items.slice(0, -1));
		apply(next, false);
	}, [apply, document, redo]);
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				!(event.metaKey || event.ctrlKey) ||
				event.key.toLocaleLowerCase() !== "z"
			)
				return;
			event.preventDefault();
			if (event.shiftKey) redoLast();
			else undoLast();
		};
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [redoLast, undoLast]);
	const visible = active.current
		? [...document.strokes, active.current]
		: document.strokes;
	return (
		<ThemeProvider value={darkTheme}>
			<SafeAreaProvider>
				<section className="drawing-pad" aria-label="Drawing canvas">
					<svg
						role="img"
						aria-label="Drawing canvas"
						viewBox={`0 0 ${document.width} ${document.height}`}
						style={{
							width: "100%",
							height: "auto",
							minHeight: 360,
							touchAction: "none",
							...backgroundStyle(document),
						}}
						onPointerDown={start}
						onPointerMove={move}
						onPointerUp={end}
						onPointerCancel={end}
					>
						{visible.map((stroke) => (
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
					<DrawingToolbar
						tool={tool}
						color={color}
						strokeWidth={strokeWidth}
						backgroundPattern={document.background.pattern}
						canUndo={undo.length > 0}
						canRedo={redo.length > 0}
						onToolChange={setTool}
						onColorChange={setColor}
						onWidthChange={setStrokeWidth}
						onCycleBackground={cycleBackground}
						onUndo={undoLast}
						onRedo={redoLast}
					/>
				</section>
			</SafeAreaProvider>
		</ThemeProvider>
	);
}
