import type { CSSProperties, ImgHTMLAttributes } from "react";

type Source = { uri: string };
export type ImageLoadEventData = { source: { width: number; height: number } };

/** Browser visual adapter for expo-image inside canonical Lexical image node. */
export function Image({ source, alt, accessibilityLabel, contentFit, onLoad, style, ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onLoad"> & { source: Source; accessibilityLabel?: string; contentFit?: "contain" | "cover"; onLoad?: (event: ImageLoadEventData) => void; style?: Record<string, unknown> | Array<Record<string, unknown> | null> }) {
	const resolvedStyle = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
	return <img {...props} alt={alt ?? accessibilityLabel ?? ""} src={source.uri} style={{ objectFit: contentFit, ...(resolvedStyle as CSSProperties) }} onLoad={(event) => onLoad?.({ source: { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight } })} />;
}
