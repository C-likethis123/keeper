import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { App } from "@/App";

it("renders the Vite home route", async () => {
	render(
		<MemoryRouter>
			<App />
		</MemoryRouter>,
	);

	expect(await screen.findByRole("heading", { name: "Notes" })).toBeInTheDocument();
});

it("creates a note and routes to its browser editor", async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<App />
		</MemoryRouter>,
	);

	await user.type(await screen.findByLabelText("Quick note title"), "Route coverage");
	await user.click(screen.getByRole("button", { name: "Create" }));

		expect(await screen.findByLabelText("Title")).toHaveValue("Route coverage");
	expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
});
