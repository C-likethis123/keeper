import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import usedIcons from "../../../scripts/icon-sources/used-icons.json";
import fontAwesomeGlyphs from "@/assets/icons/FontAwesome.json";
import ioniconsGlyphs from "@/assets/icons/Ionicons.json";
import materialCommunityGlyphs from "@/assets/icons/MaterialCommunityIcons.json";
import {
	FontAwesome,
	Ionicons,
	MaterialCommunityIcons,
} from "@/components/shared/Icons";

it("keeps shipped glyph maps in sync with subset manifest", () => {
	for (const [family, glyphs] of Object.entries({
		FontAwesome: fontAwesomeGlyphs,
		Ionicons: ioniconsGlyphs,
		MaterialCommunityIcons: materialCommunityGlyphs,
	})) {
		expect(Object.keys(glyphs).sort()).toEqual(
			[...usedIcons[family as keyof typeof usedIcons]].sort(),
		);
	}
});

it("renders exact icon-font glyphs instead of placeholder dots", () => {
	render(
		<>
			<FontAwesome name="search" />
			<Ionicons name="create-outline" />
			<MaterialCommunityIcons name="file-document-outline" />
		</>,
	);

	expect(screen.getByText(String.fromCodePoint(61442))).toHaveStyle({
		fontFamily: "KeeperFontAwesome",
	});
	expect(screen.getByText(String.fromCodePoint(62099))).toHaveStyle({
		fontFamily: "KeeperIonicons",
	});
	expect(screen.getByText(String.fromCodePoint(985582))).toHaveStyle({
		fontFamily: "KeeperMaterialCommunityIcons",
	});
	expect(document.body).not.toHaveTextContent("•");
});

it("renders unknown names as empty instead of misleading dots", () => {
	// @ts-expect-error Exercise runtime fallback for untyped callers.
	const { container } = render(<FontAwesome name="not-a-real-icon" />);
	expect(container.querySelector("[data-icon-name]")).toBeEmptyDOMElement();
});
