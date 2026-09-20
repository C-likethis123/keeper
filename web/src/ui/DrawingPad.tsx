import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from "react";

type Props = {
	value: string;
	onChange: (value: string) => void;
};

const COLORS = ["#f5f5f4", "#9ece6a", "#7aa2f7", "#f7768e"];

export function DrawingPad({ value, onChange }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const drawing = useRef(false);
	const [color, setColor] = useState(COLORS[0]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !value.startsWith("data:image/")) return;
		const image = new Image();
		image.onload = () => canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
		image.src = value;
	}, [value]);

	function point(event: PointerEvent<HTMLCanvasElement>) {
		const canvas = canvasRef.current;
		if (!canvas) return null;
		const bounds = canvas.getBoundingClientRect();
		return { x: (event.clientX - bounds.left) * (canvas.width / bounds.width), y: (event.clientY - bounds.top) * (canvas.height / bounds.height) };
	}
	function start(event: PointerEvent<HTMLCanvasElement>) {
		const canvas = canvasRef.current;
		const startPoint = point(event);
		if (!canvas || !startPoint) return;
		canvas.setPointerCapture(event.pointerId);
		const context = canvas.getContext("2d");
		if (!context) return;
		context.strokeStyle = color;
		context.lineWidth = 4;
		context.lineCap = "round";
		context.beginPath();
		context.moveTo(startPoint.x, startPoint.y);
		drawing.current = true;
	}
	function move(event: PointerEvent<HTMLCanvasElement>) {
		const canvas = canvasRef.current;
		const next = point(event);
		if (!drawing.current || !canvas || !next) return;
		const context = canvas.getContext("2d");
		if (!context) return;
		context.lineTo(next.x, next.y);
		context.stroke();
	}
	function end() {
		const canvas = canvasRef.current;
		if (!drawing.current || !canvas) return;
		drawing.current = false;
		onChange(canvas.toDataURL("image/png"));
	}
	function clear() {
		const canvas = canvasRef.current;
		if (!canvas) return;
		canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
		onChange("");
	}

	return <section className="drawing-pad" aria-label="Drawing canvas">
		<header className="drawing-pad__toolbar">
			<span>Draw</span>
			<div role="group" aria-label="Ink color">{COLORS.map((swatch) => <button key={swatch} type="button" className={color === swatch ? "drawing-color drawing-color--selected" : "drawing-color"} style={{ "--swatch": swatch } as CSSProperties} onClick={() => setColor(swatch)} aria-label={`Use ${swatch} ink`} />)}</div>
			<button type="button" className="text-button" onClick={clear}>Clear</button>
		</header>
		<canvas ref={canvasRef} className="drawing-canvas" width={1600} height={900} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
	</section>;
}
