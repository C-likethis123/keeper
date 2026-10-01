import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import {
	FontAwesome,
	Ionicons,
	MaterialCommunityIcons,
} from "./expoVectorIcons";

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
	const { container } = render(<FontAwesome name="not-a-real-icon" />);
	expect(container.querySelector("[data-icon-name]")).toBeEmptyDOMElement();
});
