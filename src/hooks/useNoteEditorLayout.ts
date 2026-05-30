import type { Note } from "@/services/notes/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PanResponder, Platform, useWindowDimensions } from "react-native";

const SPLIT_RATIO_KEY = "doc-split-ratio";
export type EditorSidePanel = "document" | "video" | "article";

function getInitialActivePanel(
	attachment: Note["attachment"],
	attachedVideo: Note["attachedVideo"],
	resourceUrl: Note["resourceUrl"],
): EditorSidePanel {
	if (attachedVideo) return "video";
	if (resourceUrl) return "article";
	if (attachment) return "document";
	return "video";
}

function getAvailablePanels(
	attachment: Note["attachment"],
	attachedVideo: Note["attachedVideo"],
	resourceUrl: Note["resourceUrl"],
): EditorSidePanel[] {
	const panels: EditorSidePanel[] = [];
	if (attachedVideo) panels.push("video");
	if (resourceUrl) panels.push("article");
	if (attachment) panels.push("document");
	return panels;
}

function clampSplitRatio(value: number): number {
	return Math.min(0.75, Math.max(0.25, value));
}

export function useNoteEditorLayout(note: Note) {
	const { width: windowWidth } = useWindowDimensions();
	const isDesktop = Platform.OS === "web";

	const [activePanel, setActivePanel] = useState<EditorSidePanel>(() =>
		getInitialActivePanel(note.attachment, note.attachedVideo, note.resourceUrl),
	);

	// Reset active panel when note changes (e.g. switching tabs)
	useEffect(() => {
		setActivePanel(
			getInitialActivePanel(note.attachment, note.attachedVideo, note.resourceUrl),
		);
	}, [note.attachment, note.attachedVideo, note.resourceUrl]);
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
					setSplitRatio((r) => clampSplitRatio(r + delta));
				},
				onPanResponderRelease: (_, gestureState) => {
					const delta = isDesktop
						? gestureState.dx / windowWidth
						: gestureState.dy / (windowWidth * (9 / 16));
					setSplitRatio((r) => {
						const next = clampSplitRatio(r + delta);
						AsyncStorage.setItem(SPLIT_RATIO_KEY, String(next));
						return next;
					});
				},
			}),
		[isDesktop, windowWidth],
	);

	const toggleActivePanel = useCallback(() => {
		const availablePanels = getAvailablePanels(
			note.attachment,
			note.attachedVideo,
			note.resourceUrl,
		);
		if (availablePanels.length === 0) return;
		setActivePanel((current) => {
			const currentIndex = availablePanels.indexOf(current);
			return availablePanels[(currentIndex + 1) % availablePanels.length];
		});
	}, [note.attachment, note.attachedVideo, note.resourceUrl]);

	return {
		activePanel,
		setActivePanel,
		toggleActivePanel,
		splitRatio,
		panResponder,
		isDesktop,
	};
}
