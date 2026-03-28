import {
	type PropsWithChildren,
	type RefObject,
	createContext,
	useContext,
	useRef,
} from "react";
import { Dimensions, type ScrollView } from "react-native";
interface EditorScrollContextValue {
	scrollViewRef: RefObject<ScrollView | null>;
	scrollYRef: RefObject<number>;
	viewHeightRef: RefObject<number>;
	viewportHeight: number;
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
	viewportHeight: 0,
});

export function useEditorScrollView(): EditorScrollContextValue {
	return useContext(EditorScrollContext);
}

export function EditorScrollProvider({ children }: PropsWithChildren) {
	const scrollViewRef = useRef<ScrollView>(null);
	const scrollYRef = useRef(0);
	const viewHeightRef = useRef(0);
	const viewportHeight = Dimensions.get("window").height;
	return (
		<EditorScrollContext.Provider
			value={{
				scrollViewRef,
				scrollYRef,
				viewHeightRef,
				viewportHeight,
			}}
		>
			{children}
		</EditorScrollContext.Provider>
	);
}
