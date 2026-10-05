import { useLayoutEffect, type ReactNode } from "react";
import { vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAppKeyboardShortcuts } from "../useAppKeyboardShortcuts";

describe("useAppKeyboardShortcuts", () => {
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
		const onFocusSearch = vi.fn();
		renderHook(() => useAppKeyboardShortcuts({ onFocusSearch }));

		const event = fireKey("k", { metaKey: true });

		expect(onFocusSearch).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
	});

	it("calls onFocusSearch when Ctrl+K is pressed", () => {
		const onFocusSearch = vi.fn();
		renderHook(() => useAppKeyboardShortcuts({ onFocusSearch }));

		fireKey("k", { ctrlKey: true });

		expect(onFocusSearch).toHaveBeenCalledTimes(1);
	});

	it("calls onFocusSearch when Cmd+P is pressed", () => {
		const onFocusSearch = vi.fn();
		renderHook(() => useAppKeyboardShortcuts({ onFocusSearch }));

		fireKey("p", { metaKey: true });

		expect(onFocusSearch).toHaveBeenCalledTimes(1);
	});

	it("calls onCreateNote when Cmd+N is pressed", () => {
		const onCreateNote = vi.fn();
		renderHook(() => useAppKeyboardShortcuts({ onCreateNote }));

		const event = fireKey("n", { metaKey: true });

		expect(onCreateNote).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
	});

	it("calls onCreateNote when Ctrl+N is pressed", () => {
		const onCreateNote = vi.fn();
		renderHook(() => useAppKeyboardShortcuts({ onCreateNote }));

		fireKey("n", { ctrlKey: true });

		expect(onCreateNote).toHaveBeenCalledTimes(1);
	});

	it("calls onForceSave when Cmd+S is pressed", () => {
		const onForceSave = vi.fn();
		renderHook(() => useAppKeyboardShortcuts({ onForceSave }));

		const event = fireKey("s", { metaKey: true });

		expect(onForceSave).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
	});

	it("calls onForceSave when Ctrl+S is pressed", () => {
		const onForceSave = vi.fn();
		renderHook(() => useAppKeyboardShortcuts({ onForceSave }));

		fireKey("s", { ctrlKey: true });

		expect(onForceSave).toHaveBeenCalledTimes(1);
	});

	it("calls onOpenFindReplace when Cmd+F is pressed", () => {
		const onOpenFindReplace = vi.fn();
		renderHook(() => useAppKeyboardShortcuts({ onOpenFindReplace }));

		const event = fireKey("f", { metaKey: true });

		expect(onOpenFindReplace).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
	});

	it("calls onOpenFindReplace when Ctrl+F is pressed", () => {
		const onOpenFindReplace = vi.fn();
		renderHook(() => useAppKeyboardShortcuts({ onOpenFindReplace }));

		fireKey("f", { ctrlKey: true });

		expect(onOpenFindReplace).toHaveBeenCalledTimes(1);
	});

	it("does not call any callback for unregistered chords", () => {
		const onFocusSearch = vi.fn();
		const onCreateNote = vi.fn();
		const onForceSave = vi.fn();
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
		const onCreateNote = vi.fn();
		renderHook(() => useAppKeyboardShortcuts({ onCreateNote }));

		const event = fireKey("s", { metaKey: true });

		expect(onCreateNote).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it("does not intercept find when the route does not provide that callback", () => {
		const onCreateNote = vi.fn();
		renderHook(() => useAppKeyboardShortcuts({ onCreateNote }));

		const event = fireKey("f", { ctrlKey: true });

		expect(onCreateNote).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it("ignores document without listener APIs", () => {
		const descriptor = Object.getOwnPropertyDescriptor(
			document,
			"addEventListener",
		);
		function WithoutListener({ children }: { children: ReactNode }) {
			useLayoutEffect(() => {
				Object.defineProperty(document, "addEventListener", {
					configurable: true,
					value: undefined,
				});
			}, []);
			return children;
		}
		try {
			const onCreateNote = vi.fn();
			const { unmount } = renderHook(
				() => useAppKeyboardShortcuts({ onCreateNote }),
				{ wrapper: WithoutListener },
			);
			fireKey("n", { metaKey: true });
			expect(onCreateNote).not.toHaveBeenCalled();
			unmount();
		} finally {
			if (descriptor)
				Object.defineProperty(document, "addEventListener", descriptor);
			else Reflect.deleteProperty(document, "addEventListener");
		}
	});

	it("removes the listener when the hook unmounts", () => {
		const onCreateNote = vi.fn();
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
