import { act, cleanup, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useAppKeyboardShortcuts } from "../useAppKeyboardShortcuts";

class TestKeyboardEvent extends Event {
	key: string;
	code: string;
	metaKey: boolean;
	ctrlKey: boolean;
	altKey: boolean;
	shiftKey: boolean;

	constructor(
		type: string,
		init: KeyboardEventInit & { key: string; code: string },
	) {
		super(type, init);
		this.key = init.key;
		this.code = init.code;
		this.metaKey = init.metaKey ?? false;
		this.ctrlKey = init.ctrlKey ?? false;
		this.altKey = init.altKey ?? false;
		this.shiftKey = init.shiftKey ?? false;
	}
}

class TestDocument {
	private listeners = new Set<EventListenerOrEventListenerObject>();

	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
	) {
		if (type === "keydown" && listener) {
			this.listeners.add(listener);
		}
	}

	removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
	) {
		if (type === "keydown" && listener) {
			this.listeners.delete(listener);
		}
	}

	dispatchEvent(event: Event) {
		for (const listener of Array.from(this.listeners)) {
			if (typeof listener === "function") {
				listener(event);
			} else {
				listener.handleEvent(event);
			}
		}
		return !event.defaultPrevented;
	}
}

describe("useAppKeyboardShortcuts", () => {
	let originalOS: typeof Platform.OS;
	let originalDocument: typeof globalThis.document;
	let originalKeyboardEvent: typeof globalThis.KeyboardEvent;
	let testDocument: Document;

	beforeAll(() => {
		originalOS = Platform.OS;
		originalDocument = globalThis.document;
		originalKeyboardEvent = globalThis.KeyboardEvent;
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: undefined,
			writable: true,
		});
		Object.defineProperty(globalThis, "KeyboardEvent", {
			configurable: true,
			value: TestKeyboardEvent,
			writable: true,
		});
		(Platform as unknown as { OS: string }).OS = "web";
	});

	beforeEach(() => {
		testDocument = new TestDocument() as unknown as Document;
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: testDocument,
			writable: true,
		});
	});

	afterAll(() => {
		(Platform as unknown as { OS: string }).OS = originalOS;
		Object.defineProperty(globalThis, "document", {
			configurable: true,
			value: originalDocument,
			writable: true,
		});
		Object.defineProperty(globalThis, "KeyboardEvent", {
			configurable: true,
			value: originalKeyboardEvent,
			writable: true,
		});
	});

	afterEach(() => {
		cleanup();
	});

	function fireKey(
		key: string,
		opts: { metaKey?: boolean; ctrlKey?: boolean } = {},
	) {
		const event = new KeyboardEvent("keydown", {
			key,
			code: `Key${key.toUpperCase()}`,
			bubbles: true,
			cancelable: true,
			...opts,
		});
		act(() => {
			document.dispatchEvent(event);
		});
		return event;
	}

	it("calls onFocusSearch when Cmd+K is pressed", () => {
		const onFocusSearch = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onFocusSearch }));

		const event = fireKey("k", { metaKey: true });

		expect(onFocusSearch).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
	});

	it("calls onFocusSearch when Ctrl+K is pressed", () => {
		const onFocusSearch = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onFocusSearch }));

		fireKey("k", { ctrlKey: true });

		expect(onFocusSearch).toHaveBeenCalledTimes(1);
	});

	it("calls onFocusSearch when Cmd+P is pressed", () => {
		const onFocusSearch = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onFocusSearch }));

		fireKey("p", { metaKey: true });

		expect(onFocusSearch).toHaveBeenCalledTimes(1);
	});

	it("calls onCreateNote when Cmd+N is pressed", () => {
		const onCreateNote = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onCreateNote }));

		const event = fireKey("n", { metaKey: true });

		expect(onCreateNote).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
	});

	it("calls onCreateNote when Ctrl+N is pressed", () => {
		const onCreateNote = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onCreateNote }));

		fireKey("n", { ctrlKey: true });

		expect(onCreateNote).toHaveBeenCalledTimes(1);
	});

	it("calls onForceSave when Cmd+S is pressed", () => {
		const onForceSave = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onForceSave }));

		const event = fireKey("s", { metaKey: true });

		expect(onForceSave).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
	});

	it("calls onForceSave when Ctrl+S is pressed", () => {
		const onForceSave = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onForceSave }));

		fireKey("s", { ctrlKey: true });

		expect(onForceSave).toHaveBeenCalledTimes(1);
	});

	it("calls onOpenFindReplace when Cmd+F is pressed", () => {
		const onOpenFindReplace = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onOpenFindReplace }));

		const event = fireKey("f", { metaKey: true });

		expect(onOpenFindReplace).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
	});

	it("calls onOpenFindReplace when Ctrl+F is pressed", () => {
		const onOpenFindReplace = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onOpenFindReplace }));

		fireKey("f", { ctrlKey: true });

		expect(onOpenFindReplace).toHaveBeenCalledTimes(1);
	});

	it("does not call any callback for unregistered chords", () => {
		const onFocusSearch = jest.fn();
		const onCreateNote = jest.fn();
		const onForceSave = jest.fn();
		renderHook(() =>
			useAppKeyboardShortcuts({ onFocusSearch, onCreateNote, onForceSave }),
		);

		fireKey("z", { metaKey: true });
		fireKey("b", { ctrlKey: true });

		expect(onFocusSearch).not.toHaveBeenCalled();
		expect(onCreateNote).not.toHaveBeenCalled();
		expect(onForceSave).not.toHaveBeenCalled();
	});

	it("does not intercept a registered command when the route does not provide that callback", () => {
		const onCreateNote = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onCreateNote }));

		const event = fireKey("s", { metaKey: true });

		expect(onCreateNote).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it("removes the listener when the hook unmounts", () => {
		const onCreateNote = jest.fn();
		const { unmount } = renderHook(() =>
			useAppKeyboardShortcuts({ onCreateNote }),
		);

		act(() => {
			unmount();
		});
		fireKey("n", { metaKey: true });

		expect(onCreateNote).not.toHaveBeenCalled();
	});
});
