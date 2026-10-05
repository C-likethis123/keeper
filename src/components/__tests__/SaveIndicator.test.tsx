import { vi } from "vitest";
import { SaveIndicator } from "@/components/SaveIndicator";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/shared/Icons", async () => {
	const React = await import("react");
	return {
		FontAwesome: ({ name }: { name: string }) =>
			React.createElement("span", null, name),
	};
});

vi.mock("@/hooks/useStyles", () => ({
	useStyles: (factory: (theme: unknown) => unknown) =>
		factory({
			colors: {
				text: "#111827",
				textMuted: "#6b7280",
				statusSaving: "#f59e0b",
				statusSaved: "#16a34a",
			},
		}),
}));

describe("SaveIndicator", () => {
	it("renders nothing while idle", () => {
		const { container } = render(<SaveIndicator status="idle" />);

		expect(container).toBeEmptyDOMElement();
	});

	it("shows saving status copy and icon", () => {
		render(<SaveIndicator status="saving" />);

		expect(screen.getByText("Saving…")).toBeInTheDocument();
		expect(screen.getByText("spinner")).toBeInTheDocument();
	});

	it("shows saved status copy and icon", () => {
		render(<SaveIndicator status="saved" />);

		expect(screen.getByText("Saved")).toBeInTheDocument();
		expect(screen.getByText("check-circle")).toBeInTheDocument();
	});
});
