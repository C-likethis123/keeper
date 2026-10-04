import fontAwesomeGlyphs from "@/assets/icons/FontAwesome.json";
import ioniconsGlyphs from "@/assets/icons/Ionicons.json";
import materialCommunityGlyphs from "@/assets/icons/MaterialCommunityIcons.json";
import type { CSSProperties } from "react";

type IconStyle = CSSProperties | false | null | undefined | IconStyle[];

type IconProps = {
	name: string;
	size?: number;
	color?: string;
	style?: IconStyle;
};

function flattenStyle(style: IconStyle): CSSProperties {
	if (!style) return {};
	if (!Array.isArray(style)) return style;
	return Object.assign({}, ...style.map(flattenStyle));
}

function glyphFor(name: string, glyphs: Record<string, number>): string {
	const codePoint = glyphs[name];
	return codePoint == null ? "" : String.fromCodePoint(codePoint);
}

function IconGlyph({
	name,
	size = 16,
	color,
	style,
	fontFamily,
	glyphs,
}: IconProps & {
	fontFamily: string;
	glyphs: Record<string, number>;
}) {
	return (
		<span
			aria-hidden="true"
			data-icon-name={name}
			style={{
				display: "inline-block",
				fontFamily,
				fontSize: size,
				fontStyle: "normal",
				fontWeight: "normal",
				lineHeight: 1,
				textRendering: "auto",
				...flattenStyle(style),
				...(color ? { color } : null),
			}}
		>
			{glyphFor(name, glyphs)}
		</span>
	);
}

/** Browser icons backed by locally bundled font assets and glyph maps. */
export function FontAwesome(props: IconProps) {
	return (
		<IconGlyph
			{...props}
			fontFamily="KeeperFontAwesome"
			glyphs={fontAwesomeGlyphs}
		/>
	);
}

export function Ionicons(props: IconProps) {
	return (
		<IconGlyph
			{...props}
			fontFamily="KeeperIonicons"
			glyphs={ioniconsGlyphs}
		/>
	);
}

export function MaterialCommunityIcons(props: IconProps) {
	return (
		<IconGlyph
			{...props}
			fontFamily="KeeperMaterialCommunityIcons"
			glyphs={materialCommunityGlyphs}
		/>
	);
}
