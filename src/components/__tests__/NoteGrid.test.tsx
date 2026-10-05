import { vi } from "vitest";
import NoteGrid from "@/components/NoteGrid";
import type { Note } from "@/services/notes/types";
import { fireEvent, render, screen } from "@testing-library/react";
vi.mock("@/components/NoteCard", async () => {
	const React = await import("react");
	return {
		default: ({ note }: { note: Note }) =>
			React.createElement("span", null, note.title),
	};
});

vi.mock("@/components/shared/EmptyState", async () => {
	const React = await import("react");
	return {
		default: ({ title }: { title: string }) =>
			React.createElement("span", null, title),
	};
});

vi.mock("@/hooks/useExtendedTheme", () => ({
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
	it("does not request another page while scrolling far from bottom", () => {
		const onEndReached = vi.fn();
		render(
			<NoteGrid
				notes={makeNotes(20)}
				onOpen={() => {}}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
				onEndReached={onEndReached}
				hasMore
			/>,
		);
		const list = screen.getByRole("region", { name: "Notes" });
		Object.defineProperties(list, {
			clientHeight: { value: 500 },
			scrollHeight: { value: 2000 },
		});
		fireEvent.scroll(list, { target: { scrollTop: 100 } });
		fireEvent(list, new Event("scrollend"));
		expect(onEndReached).not.toHaveBeenCalled();
	});

	it("expands rendered rows before requesting external page", () => {
		const onEndReached = vi.fn();
		render(
			<NoteGrid
				notes={makeNotes(100)}
				onOpen={() => {}}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
				onEndReached={onEndReached}
				hasMore
			/>,
		);
		const list = screen.getByRole("region", { name: "Notes" });
		Object.defineProperties(list, {
			clientHeight: { value: 500 },
			scrollHeight: { value: 600 },
		});
		fireEvent.scroll(list, { target: { scrollTop: 100 } });
		expect(screen.getByText("Note 99")).toBeInTheDocument();
		expect(onEndReached).not.toHaveBeenCalled();
	});
	it("reports readiness after list content mounts", () => {
		const onReady = vi.fn();
		render(
			<NoteGrid
				notes={makeNotes(2)}
				onOpen={() => {}}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
				onReady={onReady}
			/>,
		);

		expect(onReady).toHaveBeenCalledTimes(1);
	});

	it("does not load more before user scrolls", () => {
		const onEndReached = vi.fn();
		render(
			<NoteGrid
				notes={makeNotes(20)}
				onOpen={() => {}}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
				onEndReached={onEndReached}
				hasMore
				isLoadingMore={false}
			/>,
		);

		fireEvent(
			screen.getByRole("region", { name: "Notes" }),
			new Event("scrollend"),
		);

		expect(onEndReached).not.toHaveBeenCalled();
	});

	it("renders a bounded initial window", () => {
		render(
			<NoteGrid
				notes={makeNotes(100)}
				onOpen={() => {}}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
			/>,
		);

		expect(screen.getAllByText(/^Note \d+$/)).toHaveLength(80);
		expect(screen.getByText("Note 79")).toBeInTheDocument();
		expect(screen.queryByText("Note 80")).not.toBeInTheDocument();
	});

	it("keeps first load to one page when content cannot fill the viewport", () => {
		const onEndReached = vi.fn();
		render(
			<NoteGrid
				notes={makeNotes(2)}
				onOpen={() => {}}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
				onEndReached={onEndReached}
				hasMore
				isLoadingMore={false}
			/>,
		);

		const list = screen.getByRole("region", { name: "Notes" });
		fireEvent(list, new Event("scrollend"));
		fireEvent(list, new Event("scrollend"));
		expect(onEndReached).not.toHaveBeenCalled();
	});

	it("loads one page per user scroll near bottom", () => {
		const onEndReached = vi.fn();
		render(
			<NoteGrid
				notes={makeNotes(20)}
				onOpen={() => {}}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
				onEndReached={onEndReached}
				hasMore
				isLoadingMore={false}
			/>,
		);

		const list = screen.getByRole("region", { name: "Notes" });
		Object.defineProperties(list, {
			clientHeight: { value: 500, configurable: true },
			scrollHeight: { value: 600, configurable: true },
		});
		fireEvent.scroll(list, { target: { scrollTop: 100 } });
		fireEvent(list, new Event("scrollend"));
		fireEvent(list, new Event("scrollend"));

		expect(onEndReached).toHaveBeenCalledTimes(1);

		fireEvent.scroll(list, { target: { scrollTop: 200 } });
		fireEvent(list, new Event("scrollend"));

		expect(onEndReached).toHaveBeenCalledTimes(2);
	});

	it("renders a list header component above the notes", () => {
		render(
			<NoteGrid
				notes={makeNotes(2)}
				onOpen={() => {}}
				onDelete={() => {}}
				onPinToggle={() => {}}
				onRefresh={() => {}}
				listHeaderComponent={<span>Take a note...</span>}
			/>,
		);

		expect(screen.getByText("Take a note...")).toBeInTheDocument();
	});

	it("renders section headers when grouped sections are provided", () => {
		const notes = makeNotes(3);

		render(
			<NoteGrid
				notes={notes}
				onOpen={() => {}}
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

		expect(screen.getByText("Pinned")).toBeInTheDocument();
		expect(screen.getByText("Recently Edited")).toBeInTheDocument();
	});
});
