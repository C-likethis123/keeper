import { FilterDrawerContent } from "@/components/FilterDrawerContent";
import { useFilterStore } from "@/stores/filterStore";
import type {
	DrawerContentComponentProps,
	DrawerNavigationProp,
} from "@react-navigation/drawer";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

const mockCloseDrawer = jest.fn();

const mockNavigation: DrawerNavigationProp<Record<string, undefined>> = {
	closeDrawer: mockCloseDrawer,
} as unknown as DrawerNavigationProp<Record<string, undefined>>;

const mockDrawerProps = {
	navigation: mockNavigation,
	descriptors: {},
	state: { routes: [], index: 0 },
} as unknown as DrawerContentComponentProps;

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@/hooks/useExtendedTheme", () => ({
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

jest.mock("@/hooks/useStyles", () => ({
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

		expect(screen.getByText("Filter")).toBeOnTheScreen();
		expect(screen.getByText("All notes")).toBeOnTheScreen();
		expect(screen.getByText("Journals")).toBeOnTheScreen();
		expect(screen.getByText("Resources")).toBeOnTheScreen();
		expect(screen.getByText("Todos")).toBeOnTheScreen();
	});

	it("selecting a type updates the filter store", () => {
		render(<FilterDrawerContent {...mockDrawerProps} />);

		fireEvent.press(screen.getByText("Journals"));

		expect(useFilterStore.getState().noteTypes).toEqual(["journal"]);
	});

	it("shows status options only when Todos is selected", () => {
		const { rerender } = render(<FilterDrawerContent {...mockDrawerProps} />);

		expect(screen.queryByText("Open")).not.toBeOnTheScreen();

		fireEvent.press(screen.getByText("Todos"));

		rerender(<FilterDrawerContent {...mockDrawerProps} />);

		expect(screen.getByText("Open")).toBeOnTheScreen();
		expect(screen.getByText("Doing")).toBeOnTheScreen();
	});

	it("selecting All notes clears the filter", () => {
		useFilterStore.getState().setNoteTypes(["journal"]);

		render(<FilterDrawerContent {...mockDrawerProps} />);

		fireEvent.press(screen.getByText("All notes"));

		expect(useFilterStore.getState().noteTypes).toEqual([]);
	});

	it("closing the drawer on status selection", () => {
		useFilterStore.getState().setNoteTypes(["todo"]);

		const { rerender } = render(<FilterDrawerContent {...mockDrawerProps} />);

		fireEvent.press(screen.getByText("Doing"));

		expect(mockCloseDrawer).toHaveBeenCalled();
	});
});
