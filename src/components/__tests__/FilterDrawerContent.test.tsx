import { vi } from "vitest";
const { mockCloseDrawer } = vi.hoisted(() => ({
	mockCloseDrawer: vi.fn(),
}));
import { FilterDrawerContent } from "@/components/FilterDrawerContent";
import { useFilterStore } from "@/stores/filterStore";
import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";

const mockNavigation = {
	closeDrawer: mockCloseDrawer,
};

const mockDrawerProps = {
	navigation: mockNavigation,
} satisfies React.ComponentProps<typeof FilterDrawerContent>;

vi.mock("@/components/shared/SafeArea", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			background: "#ffffff",
			border: "#d0d7de",
			text: "#111827",
			textMuted: "#6b7280",
			textFaded: "#9ca3af",
			primary: "#f59e0b",
			primaryContrast: "#ffffff",
			card: "#f9fafb",
		},
	}),
}));

vi.mock("@/hooks/useStyles", () => ({
	useStyles: (factory: (theme: unknown) => unknown) =>
		factory({
			colors: {
				background: "#ffffff",
				border: "#d0d7de",
				text: "#111827",
				textMuted: "#6b7280",
				textFaded: "#9ca3af",
				primary: "#f59e0b",
				primaryContrast: "#ffffff",
				card: "#f9fafb",
			},
		}),
}));

describe("FilterDrawerContent", () => {
	beforeEach(() => {
		mockCloseDrawer.mockReset();
		useFilterStore.setState({
			noteTypes: [],
			status: undefined,
		});
	});

	it("renders all filter options", () => {
		render(<FilterDrawerContent {...mockDrawerProps} />);

		expect(screen.getByText("Filter")).toBeInTheDocument();
		expect(screen.getByText("All notes")).toBeInTheDocument();
		expect(screen.getByText("Journals")).toBeInTheDocument();
		expect(screen.getByText("Resources")).toBeInTheDocument();
		expect(screen.getByText("Todos")).toBeInTheDocument();
	});

	it("selecting a type updates the filter store", () => {
		render(<FilterDrawerContent {...mockDrawerProps} />);

		fireEvent.click(screen.getByText("Journals"));

		expect(useFilterStore.getState().noteTypes).toEqual(["journal"]);
	});

	it("shows status options only when Todos is selected", () => {
		const { rerender } = render(<FilterDrawerContent {...mockDrawerProps} />);

		expect(screen.queryByText("Open")).not.toBeInTheDocument();

		fireEvent.click(screen.getByText("Todos"));

		rerender(<FilterDrawerContent {...mockDrawerProps} />);

		expect(screen.getByText("Open")).toBeInTheDocument();
		expect(screen.getByText("Doing")).toBeInTheDocument();
	});

	it("selecting All notes clears the filter", () => {
		useFilterStore.getState().setNoteTypes(["journal"]);

		render(<FilterDrawerContent {...mockDrawerProps} />);

		fireEvent.click(screen.getByText("All notes"));

		expect(useFilterStore.getState().noteTypes).toEqual([]);
	});

	it("closing the drawer on status selection", () => {
		useFilterStore.getState().setNoteTypes(["todo"]);

		const { rerender } = render(<FilterDrawerContent {...mockDrawerProps} />);

		fireEvent.click(screen.getByText("Doing"));

		expect(mockCloseDrawer).toHaveBeenCalled();
	});
});
