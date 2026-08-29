import {
	ensureWikiLinkTarget,
	WikiLinkExtension,
} from "../WikiLinkExtension";
import { createWikiLinkUrl } from "../wikiLinkUrl";

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

function registerWikiLinkExtension(
	editor: ReturnType<typeof createEditorMock>,
	onOpenWikiLink: (title: string) => void,
) {
	WikiLinkExtension.register?.(
		editor as never,
		{ getOnOpenWikiLink: () => onOpenWikiLink },
		{} as never,
	);
}

describe("WikiLinkExtension interactions", () => {
	const originalElement = global.Element;

	beforeEach(() => {
		global.Element = TestElement as unknown as typeof Element;
	});

	afterEach(() => {
		global.Element = originalElement;
	});

	it("opens wiki links from the Lexical editor root on control-mousedown", () => {
		const root = createRootMock();
		const editor = createEditorMock(root);
		const onOpenWikiLink = jest.fn();

		registerWikiLinkExtension(editor, onOpenWikiLink);

		const handleMouseDown = root.addEventListener.mock.calls.find(
			([eventName]) => eventName === "mousedown",
		)?.[1];
		const event = {
			ctrlKey: true,
			target: new TestElement(createWikiLinkUrl("Project Alpha")),
			preventDefault: jest.fn(),
			stopPropagation: jest.fn(),
		};
		handleMouseDown(event);

		expect(onOpenWikiLink).toHaveBeenCalledWith("Project Alpha");
		expect(event.preventDefault).toHaveBeenCalled();
		expect(event.stopPropagation).toHaveBeenCalled();
	});

	it("ignores unmodified wiki link clicks", () => {
		const root = createRootMock();
		const editor = createEditorMock(root);
		const onOpenWikiLink = jest.fn();

		registerWikiLinkExtension(editor, onOpenWikiLink);

		const handleMouseDown = root.addEventListener.mock.calls.find(
			([eventName]) => eventName === "mousedown",
		)?.[1];
		const event = {
			target: new TestElement(createWikiLinkUrl("Project Alpha")),
			preventDefault: jest.fn(),
			stopPropagation: jest.fn(),
		};
		handleMouseDown(event);

		expect(onOpenWikiLink).not.toHaveBeenCalled();
		expect(event.preventDefault).not.toHaveBeenCalled();
	});

	it("ignores ordinary links", () => {
		const root = createRootMock();
		const editor = createEditorMock(root);
		const onOpenWikiLink = jest.fn();

		registerWikiLinkExtension(editor, onOpenWikiLink);

		const handleMouseDown = root.addEventListener.mock.calls.find(
			([eventName]) => eventName === "mousedown",
		)?.[1];
		const event = {
			ctrlKey: true,
			target: new TestElement("https://example.com"),
			preventDefault: jest.fn(),
			stopPropagation: jest.fn(),
		};
		handleMouseDown(event);

		expect(onOpenWikiLink).not.toHaveBeenCalled();
		expect(event.preventDefault).not.toHaveBeenCalled();
	});

	it("creates a note for a create-result wikilink", async () => {
		const resolveOrCreate = jest.fn().mockResolvedValue("new-note-id");

		await ensureWikiLinkTarget(
			{ id: "create-Project Alpha", title: "Project Alpha", type: "create" },
			resolveOrCreate,
		);

		expect(resolveOrCreate).toHaveBeenCalledWith("Project Alpha");
	});

	it("does not create a note for an existing-result wikilink", async () => {
		const resolveOrCreate = jest.fn();

		await ensureWikiLinkTarget(
			{
				id: "note-project-alpha",
				noteId: "note-project-alpha",
				title: "Project Alpha",
				type: "existing",
			},
			resolveOrCreate,
		);

		expect(resolveOrCreate).not.toHaveBeenCalled();
	});
});
