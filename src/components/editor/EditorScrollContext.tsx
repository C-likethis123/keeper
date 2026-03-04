import { type RefObject, createContext, useContext } from "react";
import type { ScrollView } from "react-native";
export interface EditorScrollContextValue {
	scrollViewRef: RefObject<ScrollView | null>;
	scrollYRef: RefObject<number>;
	viewHeightRef: RefObject<number>;
}
export const EditorScrollContext =
	createContext<EditorScrollContextValue | null>(null);

export function useEditorScrollView(): EditorScrollContextValue | null {
	return useContext(EditorScrollContext);
}
