/**
 * @jest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useAppKeyboardShortcuts } from "../useAppKeyboardShortcuts";

describe("useAppKeyboardShortcuts", () => {
	let originalOS: typeof Platform.OS;

	beforeAll(() => {
		originalOS = Platform.OS;
		(Platform as unknown as { OS: string }).OS = "web";
	});

	afterAll(() => {
		(Platform as unknown as { OS: string }).OS = originalOS;
	});

	function fireKey(
		key: string,
		opts: { metaKey?: boolean; ctrlKey?: boolean } = {},
	) {
		act(() => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key,
					code: `Key${key.toUpperCase()}`,
					bubbles: true,
					cancelable: true,
					...opts,
				}),
			);
		});
	}

	it("calls onFocusSearch when Cmd+K is pressed", () => {
		const onFocusSearch = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onFocusSearch }));

		fireKey("k", { metaKey: true });

		expect(onFocusSearch).toHaveBeenCalledTimes(1);
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

		fireKey("n", { metaKey: true });

		expect(onCreateNote).toHaveBeenCalledTimes(1);
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

		fireKey("s", { metaKey: true });

		expect(onForceSave).toHaveBeenCalledTimes(1);
	});

	it("calls onForceSave when Ctrl+S is pressed", () => {
		const onForceSave = jest.fn();
		renderHook(() => useAppKeyboardShortcuts({ onForceSave }));

		fireKey("s", { ctrlKey: true });

		expect(onForceSave).toHaveBeenCalledTimes(1);
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

	it("removes the listener when the hook unmounts", () => {
		const onCreateNote = jest.fn();
		const { unmount } = renderHook(() =>
			useAppKeyboardShortcuts({ onCreateNote }),
		);

		unmount();
		fireKey("n", { metaKey: true });

		expect(onCreateNote).not.toHaveBeenCalled();
	});
});
