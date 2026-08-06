import NoteGrid from "@/components/NoteGrid";
import type { Note } from "@/services/notes/types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { FlatList, Text } from "react-native";

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
	it("reports readiness after native list content is measured", () => {
		const onReady = jest.fn();
		render(
			<NoteGrid
				notes={makeNotes(2)}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
				onReady={onReady}
			/>,
		);

		fireEvent(screen.UNSAFE_getByType(FlatList), "contentSizeChange", 320, 640);

		expect(onReady).toHaveBeenCalledTimes(1);
	});

	it("does not load more before user scrolls", () => {
		const onEndReached = jest.fn();
		render(
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

		fireEvent(screen.UNSAFE_getByType(FlatList), "endReached");

		expect(onEndReached).not.toHaveBeenCalled();
	});

	it("loads one page per user scroll near bottom", () => {
		const onEndReached = jest.fn();
		render(
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

		const list = screen.UNSAFE_getByType(FlatList);
		fireEvent.scroll(list, { nativeEvent: { contentOffset: { y: 100 } } });
		fireEvent(list, "endReached");
		fireEvent(list, "endReached");

		expect(onEndReached).toHaveBeenCalledTimes(1);

		fireEvent.scroll(list, { nativeEvent: { contentOffset: { y: 200 } } });
		fireEvent(list, "endReached");

		expect(onEndReached).toHaveBeenCalledTimes(2);
	});

	it("renders a list header component above the notes", () => {
		render(
			<NoteGrid
				notes={makeNotes(2)}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
				listHeaderComponent={<Text>Take a note...</Text>}
			/>,
		);

		expect(screen.getByText("Take a note...")).toBeOnTheScreen();
	});

	it("renders section headers when grouped sections are provided", () => {
		const notes = makeNotes(3);

		render(
			<NoteGrid
				notes={notes}
				sections={[
					{
						id: "pinned",
						title: "Pinned",
						notes: [notes[0]],
					},
					{
						id: "recent",
						title: "Recently Edited",
						notes: [notes[1], notes[2]],
					},
				]}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
			/>,
		);

		expect(screen.getByText("Pinned")).toBeOnTheScreen();
		expect(screen.getByText("Recently Edited")).toBeOnTheScreen();
	});
});
