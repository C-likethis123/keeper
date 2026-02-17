/**
 * Returns the color with the given alpha (0–1).
 * Supports rgb(r, g, b), rgba(r, g, b, a), and #RRGGBB / #RRGGBBAA.
 */
export function withOpacity(color: string, alpha: number): string {
	const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
	if (rgbMatch) {
		const r = Number(rgbMatch[1]);
		const g = Number(rgbMatch[2]);
		const b = Number(rgbMatch[3]);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
	const hexMatch = color.match(/^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
	if (hexMatch) {
		const r = Number.parseInt(hexMatch[1].slice(0, 2), 16);
		const g = Number.parseInt(hexMatch[1].slice(2, 4), 16);
		const b = Number.parseInt(hexMatch[1].slice(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}
	return color;
}
