import { PwaInstallButton } from "@keeper/components/PwaInstallButton";
import { darkTheme } from "@keeper/constants/themes/darkTheme";
import { ThemeProvider } from "@/constants/themes/ThemeProvider";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function renderButton() {
	return render(
		<ThemeProvider value={darkTheme}>
			<PwaInstallButton />
		</ThemeProvider>,
	);
}

it("captures install prompt and clears dismissed prompt", async () => {
	const user = userEvent.setup();
	const prompt = vi.fn().mockResolvedValue(undefined);
	const preventDefault = vi.fn();
	const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
	renderButton();
	fireEvent(
		window,
		Object.assign(new Event("beforeinstallprompt"), {
			preventDefault,
			prompt,
			userChoice: Promise.resolve({ outcome: "dismissed" as const }),
		}),
	);

	await user.click(screen.getByRole("button", { name: "Install Keeper" }));
	await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
	expect(preventDefault).toHaveBeenCalledOnce();
	await user.click(screen.getByRole("button", { name: "Install Keeper" }));
	expect(prompt).toHaveBeenCalledOnce();
	expect(alert).toHaveBeenCalledOnce();
});

it("hides install action in standalone mode", () => {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn(() => ({ matches: true } as MediaQueryList)),
	});
	renderButton();
	expect(
		screen.queryByRole("button", { name: "Install Keeper" }),
	).not.toBeInTheDocument();
});
