import type { CSSProperties } from "react";

const GLYPHS: Record<string, string> = {
	undo: "↶", repeat: "↷", indent: "⇥", dedent: "⇤", table: "▦",
	image: "▧", "trash-o": "⌫", paperclip: "⌇", "video-camera": "▸",
	"newspaper-o": "▤", link: "⌁", exchange: "⇄", times: "×",
};

/** Browser presentation shim for Expo's icon surface used inside DOM editor. */
export function FontAwesome({ name, size = 16, style }: { name: string; size?: number; style?: CSSProperties | CSSProperties[] }) {
	const resolvedStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
	return <span aria-hidden="true" style={{ display: "inline-block", fontSize: size, lineHeight: 1, ...resolvedStyle }}>{GLYPHS[name] ?? "•"}</span>;
}

export function MaterialCommunityIcons({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
	return <span aria-hidden="true" style={{ display: "inline-block", fontSize: size, lineHeight: 1, color }}>{name.includes("link") ? "⌁" : "▤"}</span>;
}
