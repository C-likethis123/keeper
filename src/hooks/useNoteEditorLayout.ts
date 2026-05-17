import type { Note } from "@/services/notes/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PanResponder, Platform, useWindowDimensions } from "react-native";

const SPLIT_RATIO_KEY = "doc-split-ratio";

function getInitialActivePanel(
	attachment: Note["attachment"],
	attachedVideo: Note["attachedVideo"],
): "document" | "video" {
	if (attachedVideo) return "video";
	if (attachment) return "document";
	return "video";
}

export function useNoteEditorLayout(note: Note) {
	const { width: windowWidth } = useWindowDimensions();
	const isDesktop = Platform.OS === "web";

	const [activePanel, setActivePanel] = useState<"document" | "video">(() =>
		getInitialActivePanel(note.attachment, note.attachedVideo),
	);

	// Reset active panel when note changes (e.g. switching tabs)
	useEffect(() => {
		setActivePanel(getInitialActivePanel(note.attachment, note.attachedVideo));
	}, [note.attachment, note.attachedVideo]);
	const [splitRatio, setSplitRatio] = useState(isDesktop ? 0.5 : 0.4);

	useEffect(() => {
		AsyncStorage.getItem(SPLIT_RATIO_KEY).then((val) => {
			if (val) setSplitRatio(Number.parseFloat(val));
		});
	}, []);

	const panResponder = useMemo(
		() =>
			PanResponder.create({
				onMoveShouldSetPanResponder: () => true,
				onPanResponderMove: (_, gestureState) => {
					const delta = isDesktop
						? gestureState.dx / windowWidth
						: gestureState.dy / (windowWidth * (9 / 16));
					setSplitRatio((r) => Math.min(0.75, Math.max(0.25, r + delta)));
				},
				onPanResponderRelease: (_, gestureState) => {
					const delta = isDesktop
						? gestureState.dx / windowWidth
						: gestureState.dy / (windowWidth * (9 / 16));
					setSplitRatio((r) => {
						const next = Math.min(0.75, Math.max(0.25, r + delta));
						AsyncStorage.setItem(SPLIT_RATIO_KEY, String(next));
						return next;
					});
				},
			}),
		[isDesktop, windowWidth],
	);

	const toggleActivePanel = useCallback(() => {
		setActivePanel((p) => (p === "video" ? "document" : "video"));
	}, []);

	return {
		activePanel,
		setActivePanel,
		toggleActivePanel,
		splitRatio,
		panResponder,
		isDesktop,
	};
}
