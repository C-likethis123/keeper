import { InlineMarkdown } from "@/components/editor/rendering/InlineMarkdown";
import { render, fireEvent } from "@testing-library/react-native";
import React from "react";

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: { primary: "#2563eb" },
		typography: {
			body: { fontSize: 16, lineHeight: 24 },
			heading1: { fontSize: 32 },
			heading2: { fontSize: 24 },
			heading3: { fontSize: 20 },
		},
		custom: {
			editor: {
				inlineCode: { backgroundColor: "#f5f5f5", color: "#111827" },
			},
		},
	}),
}));

describe("WikiLink interactions in InlineMarkdown", () => {
	it("calls onWikiLinkPress when a wikilink is pressed", () => {
		const onWikiLinkPress = jest.fn();
		const { getByText } = render(
			<InlineMarkdown 
				text="Check this [[Project Alpha]] link" 
				onWikiLinkPress={onWikiLinkPress} 
			/>
		);

		const link = getByText("Project Alpha");
		const event = { nativeEvent: {} };
		fireEvent.press(link, event);

		expect(onWikiLinkPress).toHaveBeenCalledWith("Project Alpha", expect.objectContaining(event));
	});

	it("calls onWikiLinkLongPress when a wikilink is long-pressed", () => {
		const onWikiLinkLongPress = jest.fn();
		const { getByText } = render(
			<InlineMarkdown 
				text="Check this [[Project Alpha]] link" 
				onWikiLinkLongPress={onWikiLinkLongPress} 
			/>
		);

		const link = getByText("Project Alpha");
		const event = { nativeEvent: {} };
		fireEvent(link, "longPress", event);

		expect(onWikiLinkLongPress).toHaveBeenCalledWith("Project Alpha", expect.objectContaining(event));
	});
});
