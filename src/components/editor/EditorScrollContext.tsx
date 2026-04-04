import {
	type PropsWithChildren,
	type RefObject,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { ScrollView } from "react-native";

interface StickyVideoLayout {
	y: number;
	height: number;
}

interface EditorScrollContextValue {
	scrollViewRef: RefObject<ScrollView | null>;
	scrollYRef: RefObject<number>;
	viewHeightRef: RefObject<number>;
	registerVideoLayout: (index: number, layout: StickyVideoLayout) => void;
	unregisterVideoLayout: (index: number) => void;
	updateScrollY: (scrollY: number) => void;
	updateViewHeight: (viewHeight: number) => void;
}

const EditorScrollContext = createContext<EditorScrollContextValue>({
	scrollViewRef: {
		current: null,
	},
	scrollYRef: {
		current: 0,
	},
	viewHeightRef: {
		current: 0,
	},
	registerVideoLayout: () => {},
	unregisterVideoLayout: () => {},
	updateScrollY: () => {},
	updateViewHeight: () => {},
});

export function useEditorScrollView(): EditorScrollContextValue {
	return useContext(EditorScrollContext);
}

export function EditorScrollProvider({ children }: PropsWithChildren) {
	const scrollViewRef = useRef<ScrollView>(null);
	const scrollYRef = useRef(0);
	const viewHeightRef = useRef(0);
	const videoLayoutsRef = useRef(new Map<number, StickyVideoLayout>());

	const registerVideoLayout = useCallback(
		(index: number, layout: StickyVideoLayout) => {
			videoLayoutsRef.current.set(index, layout);
		},
		[],
	);

	const unregisterVideoLayout = useCallback((index: number) => {
		videoLayoutsRef.current.delete(index);
	}, []);

	const updateScrollY = useCallback((scrollY: number) => {
		scrollYRef.current = scrollY;
	}, []);

	const updateViewHeight = useCallback((viewHeight: number) => {
		viewHeightRef.current = viewHeight;
	}, []);

	useEffect(() => {
		return () => {
			videoLayoutsRef.current.clear();
		};
	}, []);

	const value = useMemo(
		() => ({
			scrollViewRef,
			scrollYRef,
			viewHeightRef,
			registerVideoLayout,
			unregisterVideoLayout,
			updateScrollY,
			updateViewHeight,
		}),
		[
			registerVideoLayout,
			unregisterVideoLayout,
			updateScrollY,
			updateViewHeight,
		],
	);

	return (
		<EditorScrollContext.Provider value={value}>
			{children}
		</EditorScrollContext.Provider>
	);
}
