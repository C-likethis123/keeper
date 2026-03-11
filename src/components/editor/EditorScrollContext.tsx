import {
	type PropsWithChildren,
	type RefObject,
	createContext,
	useContext,
	useRef,
} from "react";
import type { ScrollView } from "react-native";
interface EditorScrollContextValue {
	scrollViewRef: RefObject<ScrollView | null>;
	scrollYRef: RefObject<number>;
	viewHeightRef: RefObject<number>;
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
});

export function useEditorScrollView(): EditorScrollContextValue {
	return useContext(EditorScrollContext);
}

export function EditorScrollProvider({ children }: PropsWithChildren) {
	const scrollViewRef = useRef<ScrollView>(null);
	const scrollYRef = useRef(0);
	const viewHeightRef = useRef(0);
	return (
		<EditorScrollContext.Provider
			value={{ scrollViewRef, scrollYRef, viewHeightRef }}
		>
			{children}
		</EditorScrollContext.Provider>
	);
}
