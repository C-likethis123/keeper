import {
	InlineMarkdown,
} from "@/components/editor/rendering/InlineMarkdown";
import { parseTodoTrigger } from "@/components/editor/todoTrigger";
import { render } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			primary: "#2563eb",
		},
		typography: {
			heading1: { fontSize: 32, lineHeight: 40 },
			heading2: { fontSize: 24, lineHeight: 32 },
			heading3: { fontSize: 20, lineHeight: 28 },
			body: { fontSize: 16, lineHeight: 24 },
		},
		custom: {
			editor: {
				inlineCode: {
					fontFamily: "monospace",
					backgroundColor: "#f5f5f5",
					color: "#111827",
				},
			},
		},
	}),
}));

jest.mock("@/components/editor/blocks/MathView", () => ({
	MathView: () => null,
}));

describe("InlineMarkdown", () => {
	it("parses TODO trigger syntax for editor conversions", () => {
		expect(parseTodoTrigger("TODO ship it")).toEqual({
			keyword: "TODO",
			separator: " ",
			body: "ship it",
		});
		expect(parseTodoTrigger("todo: ship it")).toEqual({
			keyword: "todo",
			separator: ": ",
			body: "ship it",
		});
		expect(parseTodoTrigger("TODO")).toBeNull();
	});

	it("preserves a single-line height for empty text", () => {
		const { UNSAFE_getByType } = render(
			<InlineMarkdown text="" style={{ fontSize: 16, lineHeight: 24 }} />,
		);

		const container = UNSAFE_getByType(View);
		const placeholder = UNSAFE_getByType(Text);

		expect(container.props.style).toEqual(
			expect.objectContaining({ minHeight: 24 }),
		);
		expect(placeholder.props.children).toBe("\u200B");
	});
});
