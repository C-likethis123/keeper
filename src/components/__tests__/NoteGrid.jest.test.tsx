import NoteGrid from "@/components/NoteGrid";
import type { Note } from "@/services/notes/types";
import { act, render, screen } from "@testing-library/react-native";
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

		act(() => {
			UNSAFE_getByType(FlatList).props.onEndReached();
		});

		expect(onEndReached).toHaveBeenCalledTimes(1);
	});

	it("forwards repeated end-reached events while more notes are available", () => {
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

		act(() => {
			UNSAFE_getByType(FlatList).props.onEndReached();
		});
		act(() => {
			UNSAFE_getByType(FlatList).props.onEndReached();
		});

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
});
