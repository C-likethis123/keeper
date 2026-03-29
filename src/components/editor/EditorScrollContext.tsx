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
	stickyVideoIndex: number | null;
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
	stickyVideoIndex: null,
	registerVideoLayout: () => {},
	unregisterVideoLayout: () => {},
	updateScrollY: () => {},
	updateViewHeight: () => {},
});

export function useEditorScrollView(): EditorScrollContextValue {
	return useContext(EditorScrollContext);
}

function selectStickyVideoIndex(
	layouts: Map<number, StickyVideoLayout>,
	scrollY: number,
): number | null {
	let candidate: { index: number; y: number } | null = null;

	for (const [index, layout] of layouts.entries()) {
		if (layout.y >= scrollY) {
			continue;
		}
		if (!candidate || layout.y > candidate.y) {
			candidate = { index, y: layout.y };
		}
	}

	return candidate?.index ?? null;
}

export function EditorScrollProvider({ children }: PropsWithChildren) {
	const scrollViewRef = useRef<ScrollView>(null);
	const scrollYRef = useRef(0);
	const viewHeightRef = useRef(0);
	const videoLayoutsRef = useRef(new Map<number, StickyVideoLayout>());
	const [stickyVideoIndex, setStickyVideoIndex] = useState<number | null>(null);

	const recomputeStickyVideo = useCallback(() => {
		setStickyVideoIndex(
			selectStickyVideoIndex(videoLayoutsRef.current, scrollYRef.current),
		);
	}, []);

	const registerVideoLayout = useCallback(
		(index: number, layout: StickyVideoLayout) => {
			videoLayoutsRef.current.set(index, layout);
			recomputeStickyVideo();
		},
		[recomputeStickyVideo],
	);

	const unregisterVideoLayout = useCallback(
		(index: number) => {
			videoLayoutsRef.current.delete(index);
			recomputeStickyVideo();
		},
		[recomputeStickyVideo],
	);

	const updateScrollY = useCallback(
		(scrollY: number) => {
			scrollYRef.current = scrollY;
			recomputeStickyVideo();
		},
		[recomputeStickyVideo],
	);

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
			stickyVideoIndex,
			registerVideoLayout,
			unregisterVideoLayout,
			updateScrollY,
			updateViewHeight,
		}),
		[
			stickyVideoIndex,
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

export { selectStickyVideoIndex };
