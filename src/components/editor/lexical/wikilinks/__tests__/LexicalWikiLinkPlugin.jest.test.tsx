import { render } from "@testing-library/react-native";
import React from "react";
import { LexicalWikiLinkPlugin } from "../LexicalWikiLinkPlugin";
import { createWikiLinkUrl } from "../wikiLinkUrl";

const mockUseLexicalComposerContext = jest.fn();

jest.mock("@lexical/react/LexicalComposerContext", () => ({
	useLexicalComposerContext: () => mockUseLexicalComposerContext(),
}));

jest.mock("@lexical/react/LexicalTypeaheadMenuPlugin", () => ({
	LexicalTypeaheadMenuPlugin: () => null,
	MenuOption: class {
		key: string;

		constructor(key: string) {
			this.key = key;
		}
	},
}));

class TestElement {
	constructor(private readonly href: string | null = null) {}

	closest() {
		return this.href === null ? null : this;
	}

	getAttribute(attribute: string) {
		return attribute === "href" ? this.href : null;
	}
}

function createRootMock() {
	return {
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
	};
}

function createEditorMock(root: ReturnType<typeof createRootMock>) {
	return {
		getRootElement: jest.fn(() => root),
		registerRootListener: jest.fn((listener) => {
			listener(root, null);
			return jest.fn();
		}),
		registerCommand: jest.fn(() => jest.fn()),
		registerUpdateListener: jest.fn(() => jest.fn()),
	};
}

describe("LexicalWikiLinkPlugin interactions", () => {
	const originalElement = global.Element;

	beforeEach(() => {
		mockUseLexicalComposerContext.mockReset();
		global.Element = TestElement as unknown as typeof Element;
	});

	afterEach(() => {
		global.Element = originalElement;
	});

	it("opens wiki links from the Lexical editor root", () => {
		const root = createRootMock();
		const editor = createEditorMock(root);
		const onOpenWikiLink = jest.fn();
		mockUseLexicalComposerContext.mockReturnValue([editor]);

		render(<LexicalWikiLinkPlugin onOpenWikiLink={onOpenWikiLink} />);

		const handleClick = root.addEventListener.mock.calls.find(
			([eventName]) => eventName === "click",
		)?.[1];
		const event = {
			target: new TestElement(createWikiLinkUrl("Project Alpha")),
			preventDefault: jest.fn(),
			stopPropagation: jest.fn(),
		};
		handleClick(event);

		expect(onOpenWikiLink).toHaveBeenCalledWith("Project Alpha");
		expect(event.preventDefault).toHaveBeenCalled();
		expect(event.stopPropagation).toHaveBeenCalled();
	});

	it("ignores ordinary links", () => {
		const root = createRootMock();
		const editor = createEditorMock(root);
		const onOpenWikiLink = jest.fn();
		mockUseLexicalComposerContext.mockReturnValue([editor]);

		render(<LexicalWikiLinkPlugin onOpenWikiLink={onOpenWikiLink} />);

		const handleClick = root.addEventListener.mock.calls.find(
			([eventName]) => eventName === "click",
		)?.[1];
		const event = {
			target: new TestElement("https://example.com"),
			preventDefault: jest.fn(),
			stopPropagation: jest.fn(),
		};
		handleClick(event);

		expect(onOpenWikiLink).not.toHaveBeenCalled();
		expect(event.preventDefault).not.toHaveBeenCalled();
	});
});
