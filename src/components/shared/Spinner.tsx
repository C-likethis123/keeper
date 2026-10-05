import type { CSSProperties } from "react";
import "./shared.css";

export function Spinner({
	style,
	small = false,
}: { style?: CSSProperties; small?: boolean }) {
	return (
		<span
			className="keeper-spinner"
			role="status"
			aria-label="Loading"
			style={{ ...(small ? { width: 20, height: 20 } : {}), ...style }}
		/>
	);
}
