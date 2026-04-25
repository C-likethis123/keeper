import MOCSuggestions from "@/components/MOCSuggestions";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

const mockListActiveClusters = jest.fn();
const mockListAcceptedClusters = jest.fn();
const mockListClusterMembers = jest.fn();
const mockNotesIndexDbGetById = jest.fn();

jest.mock("@/components/MergeClusterModal", () => {
	const React = require("react");
	return {
		__esModule: true,
		default: () => React.createElement(React.Fragment, null),
	};
});

jest.mock("@/components/RenameClusterModal", () => {
	const React = require("react");
	return {
		__esModule: true,
		default: () => React.createElement(React.Fragment, null),
	};
});

jest.mock("@/services/notes/clusterFeedbackService", () => ({
	logFeedback: jest.fn(),
}));

jest.mock("@/services/notes/clusterService", () => ({
	listActiveClusters: (...args: unknown[]) => mockListActiveClusters(...args),
	listAcceptedClusters: (...args: unknown[]) =>
		mockListAcceptedClusters(...args),
	listClusterMembers: (...args: unknown[]) => mockListClusterMembers(...args),
	clusterAccept: jest.fn(),
	clusterAddNote: jest.fn(),
	clusterDismiss: jest.fn(),
	clusterRename: jest.fn(),
}));

jest.mock("@/services/notes/notesIndexDb", () => ({
	notesIndexDbGetById: (...args: unknown[]) => mockNotesIndexDbGetById(...args),
}));

jest.mock("@/stores/storageStore", () => ({
	useStorageStore: (selector: (state: {
		contentVersion: number;
		bumpContentVersion: jest.Mock;
	}) => unknown) =>
		selector({
			contentVersion: 0,
			bumpContentVersion: jest.fn(),
		}),
}));

jest.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({
		colors: {
			card: "#ffffff",
			border: "#d0d7de",
			text: "#111827",
			textSecondary: "#6b7280",
			textMuted: "#6b7280",
			primary: "#2563eb",
			primaryContrast: "#ffffff",
			shadow: "#000000",
		},
	}),
}));

function makeCluster(id: string, name: string) {
	return {
		id,
		name,
		confidence: 0.87,
		parent_id: null,
		accepted_at: null,
		dismissed_at: null,
		created_at: Date.now(),
		updated_at: Date.now(),
	};
}

describe("MOCSuggestions", () => {
	beforeEach(() => {
		mockListActiveClusters.mockReset();
		mockListAcceptedClusters.mockReset();
		mockListClusterMembers.mockReset();
		mockNotesIndexDbGetById.mockReset();
		mockListAcceptedClusters.mockResolvedValue([]);
	});

	it("renders an inline view-all action when suggestions exist", async () => {
		mockListActiveClusters.mockResolvedValue([makeCluster("cluster-1", "Research MOC")]);
		mockListClusterMembers.mockResolvedValue([{ note_id: "note-1", score: 0.9 }]);
		mockNotesIndexDbGetById.mockResolvedValue({ id: "note-1", title: "Alpha" });
		const onPressViewAll = jest.fn();

		render(<MOCSuggestions onPressViewAll={onPressViewAll} />);

		expect(await screen.findByText("Research MOC")).toBeOnTheScreen();
		fireEvent.press(screen.getByRole("button", { name: "View all suggested MOCs" }));

		expect(onPressViewAll).toHaveBeenCalledTimes(1);
		expect(screen.getByText("Alpha")).toBeOnTheScreen();
	});

	it("renders an empty state on the dedicated screen when no suggestions exist", async () => {
		mockListActiveClusters.mockResolvedValue([]);

		render(<MOCSuggestions variant="screen" />);

		await waitFor(() => {
			expect(screen.getByText("No suggested MOCs")).toBeOnTheScreen();
		});
		expect(
			screen.getByText(
				"New note clusters will appear here after the suggestion pipeline has generated them.",
			),
		).toBeOnTheScreen();
	});
});
