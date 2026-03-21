import NoteGrid from "@/components/NoteGrid";
import type { Note } from "@/services/notes/types";
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

jest.mock("@/components/NoteCard", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		__esModule: true,
		default: ({ note }: { note: Note }) =>
			React.createElement(Text, null, note.title),
	};
});

jest.mock("@/components/shared/EmptyState", () => {
	const React = require("react");
	const { Text } = require("react-native");
	return {
		__esModule: true,
		default: ({ title }: { title: string }) =>
			React.createElement(Text, null, title),
	};
});

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			primary: "#2563eb",
		},
	}),
}));

function makeNotes(count: number): Note[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `note-${index}`,
		title: `Note ${index}`,
		content: "",
		lastUpdated: 1710000000000 + index,
		isPinned: false,
		noteType: "note",
	}));
}

describe("NoteGrid", () => {
	it("loads more notes when scrolling near the bottom", () => {
		const onEndReached = jest.fn();
		const { UNSAFE_getByType } = render(
			<NoteGrid
				notes={makeNotes(20)}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
				onEndReached={onEndReached}
				hasMore
				isLoadingMore={false}
			/>,
		);

		fireEvent.scroll(UNSAFE_getByType("RCTScrollView"), {
			nativeEvent: {
				contentOffset: { x: 0, y: 760 },
				contentSize: { width: 400, height: 1000 },
				layoutMeasurement: { width: 400, height: 100 },
			},
		});

		expect(onEndReached).toHaveBeenCalledTimes(1);
	});

	it("does not re-trigger load more for the same content height", () => {
		const onEndReached = jest.fn();
		const { UNSAFE_getByType } = render(
			<NoteGrid
				notes={makeNotes(20)}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
				onEndReached={onEndReached}
				hasMore
				isLoadingMore={false}
			/>,
		);

		const scrollView = UNSAFE_getByType("RCTScrollView");
		const nearBottomEvent = {
			nativeEvent: {
				contentOffset: { x: 0, y: 760 },
				contentSize: { width: 400, height: 1000 },
				layoutMeasurement: { width: 400, height: 100 },
			},
		};

		fireEvent.scroll(scrollView, nearBottomEvent);
		fireEvent.scroll(scrollView, nearBottomEvent);

		expect(onEndReached).toHaveBeenCalledTimes(1);
	});
});
