import { vi, type Mock } from "vitest";
const {
	mockListActiveClusters,
	mockListAcceptedClusters,
	mockListClusterMembers,
	mockNotesIndexDbGetById,
} = vi.hoisted(() => ({
	mockListActiveClusters: vi.fn(),
	mockListAcceptedClusters: vi.fn(),
	mockListClusterMembers: vi.fn(),
	mockNotesIndexDbGetById: vi.fn(),
}));
import MOCSuggestions from "@/components/moc/MOCSuggestions";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/components/moc/MergeClusterModal", async () => {
	const React = await import("react");
	return {
		default: () => React.createElement(React.Fragment, null),
	};
});

vi.mock("@/components/moc/RenameClusterModal", async () => {
	const React = await import("react");
	return {
		default: () => React.createElement(React.Fragment, null),
	};
});

vi.mock("@/services/notes/clusterFeedbackService", () => ({
	logFeedback: vi.fn(),
}));

vi.mock("@/services/notes/clusterService", () => ({
	listActiveClusters: (...args: unknown[]) => mockListActiveClusters(...args),
	listAcceptedClusters: (...args: unknown[]) =>
		mockListAcceptedClusters(...args),
	listClusterMembers: (...args: unknown[]) => mockListClusterMembers(...args),
	clusterAccept: vi.fn(),
	clusterAddNote: vi.fn(),
	clusterDismiss: vi.fn(),
	clusterRename: vi.fn(),
}));

vi.mock("@/services/notes/notesIndexDb", () => ({
	notesIndexDbGetById: (...args: unknown[]) => mockNotesIndexDbGetById(...args),
}));

vi.mock("@/stores/storageStore", () => ({
	useStorageStore: (
		selector: (state: {
			contentVersion: number;
			bumpContentVersion: Mock;
		}) => unknown,
	) =>
		selector({
			contentVersion: 0,
			bumpContentVersion: vi.fn(),
		}),
}));

vi.mock("@/hooks/useExtendedTheme", () => ({
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
		mockListActiveClusters.mockResolvedValue([
			makeCluster("cluster-1", "Research MOC"),
		]);
		mockListClusterMembers.mockResolvedValue([
			{ note_id: "note-1", score: 0.9 },
		]);
		mockNotesIndexDbGetById.mockResolvedValue({ id: "note-1", title: "Alpha" });
		const onPressViewAll = vi.fn();

		render(<MOCSuggestions onPressViewAll={onPressViewAll} />);

		expect(await screen.findByText("Research MOC")).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole("button", { name: "View all suggested MOCs" }),
		);

		expect(onPressViewAll).toHaveBeenCalledTimes(1);
		expect(screen.getByText("Alpha")).toBeInTheDocument();
	});

	it("renders an empty state on the dedicated screen when no suggestions exist", async () => {
		mockListActiveClusters.mockResolvedValue([]);

		render(<MOCSuggestions variant="screen" />);

		await waitFor(() => {
			expect(screen.getByText("No suggested MOCs")).toBeInTheDocument();
		});
		expect(
			screen.getByText(
				"New note clusters will appear here after the suggestion pipeline has generated them.",
			),
		).toBeInTheDocument();
	});
});
