import { ThemeProvider } from "@react-navigation/native";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lightTheme } from "@/constants/themes/lightTheme";
import { storageEngine } from "@/services/storage/storageEngine";
import { useFilterStore } from "@/stores/filterStore";
import { useTabStore } from "@/stores/tabStore";
import { App } from "@web/App";
import { HomeRoute } from "@web/routes/HomeRoute";
import { ViteAppShell } from "@web/shell/ViteAppShell";
import { saveBytes } from "@web/services/media";
import { BrowserNotesProvider } from "@web/state/BrowserNotesProvider";
import {
	loadBrowserNotes,
	persistBrowserNotes,
	type BrowserNote,
} from "@web/ui/noteRepository";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
	MemoryRouter,
	Route,
	Routes,
	useLocation,
	useNavigate,
} from "react-router-dom";

function note(overrides: Partial<BrowserNote> = {}): BrowserNote {
	const timestamp = overrides.lastUpdated ?? Date.now();
	return {
		id: overrides.id ?? crypto.randomUUID(),
		title: overrides.title ?? "Test note",
		content: overrides.content ?? "",
		noteType: overrides.noteType ?? "note",
		isPinned: overrides.isPinned ?? false,
		lastUpdated: timestamp,
		modified: overrides.modified ?? timestamp,
		status: overrides.status ?? null,
		createdAt: overrides.createdAt ?? timestamp,
		completedAt: overrides.completedAt ?? null,
		attachment: overrides.attachment ?? null,
		attachedVideo: overrides.attachedVideo ?? null,
		resourceUrl: overrides.resourceUrl ?? null,
		documentPositions: overrides.documentPositions ?? null,
	};
}

beforeEach(async () => {
	Object.defineProperties(URL, {
		createObjectURL: {
			configurable: true,
			value: vi.fn(() => "blob:app-document"),
		},
		revokeObjectURL: { configurable: true, value: vi.fn() },
	});
	await persistBrowserNotes([]);
	useFilterStore.getState().reset();
	useTabStore.setState({ tabs: [], activeTabId: null });
});

afterEach(() => cleanup());

it("renders persisted canonical notes at the direct home URL", async () => {
	await persistBrowserNotes([note({ title: "Persisted canonical note" })]);
	render(
		<MemoryRouter initialEntries={["/"]}>
			<App />
		</MemoryRouter>,
	);

	expect(
		await screen.findByRole("main", { name: "Notes" }),
	).toBeInTheDocument();
	expect(
		await screen.findByRole("button", {
			name: "Open note Persisted canonical note",
		}),
	).toBeInTheDocument();
});

it("opens the correct editor from a note card", async () => {
	const user = userEvent.setup();
	await persistBrowserNotes([note({ id: "open-me", title: "Open me" })]);
	render(
		<MemoryRouter initialEntries={["/"]}>
			<App />
		</MemoryRouter>,
	);

	await user.click(
		await screen.findByRole("button", { name: "Open note Open me" }),
	);
	expect(await screen.findByLabelText("Title")).toHaveValue("Open me");
});

it("supports direct editor URLs and redirects unknown routes home", async () => {
	await persistBrowserNotes([
		note({ id: "direct-note", title: "Direct note" }),
	]);
	expect((await loadBrowserNotes())[0]?.title).toBe("Direct note");
	const directView = render(
		<MemoryRouter initialEntries={["/editor/direct-note"]}>
			<App />
		</MemoryRouter>,
	);
	await waitFor(() =>
		expect(screen.getByLabelText("Title")).toHaveValue("Direct note"),
	);
	directView.unmount();

	render(
		<MemoryRouter initialEntries={["/missing-route"]}>
			<App />
		</MemoryRouter>,
	);
	expect(
		await screen.findByRole("main", { name: "Notes" }),
	).toBeInTheDocument();
});

it("opens document route with canonical panel even when video also exists", async () => {
	await storageEngine.initialize();
	const attachment = await saveBytes(
		new Uint8Array([37, 80, 68, 70]),
		"route.pdf",
		"attachments",
	);
	await persistBrowserNotes([
		note({
			id: "document-route",
			title: "Document route",
			attachment,
			attachedVideo: "https://youtu.be/dQw4w9WgXcQ",
		}),
	]);
	const filename = attachment.split("/").at(-1) ?? attachment;

	render(
		<MemoryRouter initialEntries={["/documents/document-route"]}>
			<App />
		</MemoryRouter>,
	);

	expect(await screen.findByText(filename)).toBeInTheDocument();
	expect(screen.queryByText("Video")).not.toBeInTheDocument();
});

it("removes document bytes and metadata without closing editor", async () => {
	const user = userEvent.setup();
	await storageEngine.initialize();
	const attachment = await saveBytes(
		new Uint8Array([37, 80, 68, 70]),
		"remove.pdf",
		"attachments",
	);
	await persistBrowserNotes([
		note({ id: "remove-document", attachment, documentPositions: { [attachment]: "4" } }),
	]);
	render(
		<MemoryRouter initialEntries={["/documents/remove-document"]}>
			<App />
		</MemoryRouter>,
	);

	await user.click(await screen.findByRole("button", { name: "Remove attachment" }));

	await waitFor(async () => {
		const persisted = (await loadBrowserNotes())[0];
		expect(persisted?.attachment).toBeNull();
		expect(persisted?.documentPositions).toBeNull();
		expect(await storageEngine.readFileBytes(attachment)).toBeNull();
	});
	expect(screen.getByLabelText("Title")).toBeInTheDocument();
});

it("keeps editor autosave functional while document panel is open", async () => {
	await storageEngine.initialize();
	const attachment = await saveBytes(
		new Uint8Array([37, 80, 68, 70]),
		"autosave.pdf",
		"attachments",
	);
	await persistBrowserNotes([
		note({ id: "document-autosave", title: "Before", attachment }),
	]);
	const filename = attachment.split("/").at(-1) ?? attachment;
	render(
		<MemoryRouter initialEntries={["/documents/document-autosave"]}>
			<App />
		</MemoryRouter>,
	);
	await screen.findByText(filename);

	vi.useFakeTimers();
	fireEvent.change(screen.getByLabelText("Title"), {
		target: { value: "Saved with document" },
	});
	await act(async () => {
		await vi.advanceTimersByTimeAsync(2_000);
	});
	vi.useRealTimers();

	await waitFor(async () =>
		expect((await loadBrowserNotes())[0]?.title).toBe("Saved with document"),
	);
});

it("opens direct video route, then removes video through canonical panel", async () => {
	const user = userEvent.setup();
	await persistBrowserNotes([
		note({
			id: "video-route",
			title: "Video route",
			attachedVideo: "https://youtu.be/dQw4w9WgXcQ",
			resourceUrl: "https://example.com/article",
		}),
	]);
	render(
		<MemoryRouter initialEntries={["/videos/video-route"]}>
			<App />
		</MemoryRouter>,
	);

	expect(await screen.findByTitle("Youtube video")).toBeInTheDocument();
	expect(screen.queryByTitle("Article")).not.toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: "Attach video" }));
	const videoInput = screen.getByPlaceholderText(
		"https://www.youtube.com/watch?v=...",
	);
	await user.clear(videoInput);
	await user.type(videoInput, "https://youtu.be/abcdefghijk");
	await user.click(screen.getByText("Save"));
	await waitFor(async () =>
		expect((await loadBrowserNotes())[0]?.attachedVideo).toBe(
			"https://youtu.be/abcdefghijk",
		),
	);
	await user.click(screen.getByRole("button", { name: "Remove video" }));

	await waitFor(async () =>
		expect((await loadBrowserNotes())[0]?.attachedVideo).toBeNull(),
	);
	expect(screen.queryByTitle("Youtube video")).not.toBeInTheDocument();
});

it("renders persisted article metadata in canonical article panel", async () => {
	await persistBrowserNotes([
		note({
			id: "article-panel",
			title: "Article panel",
			resourceUrl: "https://example.com/article",
		}),
	]);
	render(
		<MemoryRouter initialEntries={["/editor/article-panel"]}>
			<App />
		</MemoryRouter>,
	);

	const article = await screen.findByTitle("Article");
	expect(article).toHaveAttribute("src", "https://example.com/article");
});

it("creates one quick note and routes to its browser editor", async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<App />
		</MemoryRouter>,
	);

	await user.click(await screen.findByRole("button", { name: "Take a note" }));
	await user.type(screen.getByLabelText("Note title"), "Route coverage");
	await user.click(screen.getByRole("button", { name: "Close note" }));

	expect(await screen.findByLabelText("Title")).toHaveValue("Route coverage");
	await waitFor(async () => {
		const matching = (await loadBrowserNotes()).filter(
			(item) => item.title === "Route coverage",
		);
		expect(matching).toHaveLength(1);
	});
});

it("searches title and content, filters todos, hides done, and resets", async () => {
	const user = userEvent.setup();
	await persistBrowserNotes([
		note({ id: "plain", title: "Alpha title", content: "plain body" }),
		note({
			id: "open-todo",
			title: "Open task",
			content: "needle body",
			noteType: "todo",
			status: "open",
		}),
		note({
			id: "done-todo",
			title: "Done task",
			noteType: "todo",
			status: "done",
		}),
	]);
	render(
		<MemoryRouter>
			<App />
		</MemoryRouter>,
	);

	const search = await screen.findByLabelText("Search notes");
	await user.type(search, "needle");
	expect(
		await screen.findByRole("button", { name: "Open note Open task" }),
	).toBeInTheDocument();
	expect(
		screen.queryByRole("button", { name: "Open note Alpha title" }),
	).not.toBeInTheDocument();

	await user.clear(search);
	await user.click(screen.getByRole("button", { name: "Todos" }));
	expect(
		await screen.findByRole("button", { name: "Open note Done task" }),
	).toBeInTheDocument();
	expect(
		screen.queryByRole("button", { name: "Open note Alpha title" }),
	).not.toBeInTheDocument();

	await user.click(screen.getByRole("button", { name: "Open" }));
	await waitFor(() =>
		expect(
			screen.queryByRole("button", { name: "Open note Done task" }),
		).not.toBeInTheDocument(),
	);
	await user.click(screen.getByRole("button", { name: "All" }));
	expect(
		await screen.findByRole("button", { name: "Open note Done task" }),
	).toBeInTheDocument();

	await user.click(screen.getByRole("button", { name: "Hide done" }));
	await waitFor(() =>
		expect(
			screen.queryByRole("button", { name: "Open note Done task" }),
		).not.toBeInTheDocument(),
	);
	await user.click(screen.getByRole("button", { name: "Reset filters" }));
	expect(
		await screen.findByRole("button", { name: "Open note Alpha title" }),
	).toBeInTheDocument();
	expect(
		await screen.findByRole("button", { name: "Open note Done task" }),
	).toBeInTheDocument();
});

it("orders pinned notes before newer unpinned notes", async () => {
	await persistBrowserNotes([
		note({ id: "new", title: "Newest", lastUpdated: 300 }),
		note({ id: "pin", title: "Pinned", isPinned: true, lastUpdated: 100 }),
		note({ id: "old", title: "Oldest", lastUpdated: 50 }),
	]);
	const expectedUnpinned = (await loadBrowserNotes())
		.filter((item) => !item.isPinned)
		.sort((left, right) => right.lastUpdated - left.lastUpdated)
		.map((item) => `Open note ${item.title}`);
	render(
		<MemoryRouter>
			<App />
		</MemoryRouter>,
	);

	const cards = await screen.findAllByRole("button", { name: /^Open note / });
	expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
		"Open note Pinned",
		...expectedUnpinned,
	]);
});

function NavigationControls() {
	const navigate = useNavigate();
	const location = useLocation();
	return (
		<>
			<output aria-label="Current route">{location.pathname}</output>
			<button type="button" onClick={() => navigate(-1)}>
				History back
			</button>
			<button type="button" onClick={() => navigate(1)}>
				History forward
			</button>
		</>
	);
}

it("preserves route state across browser back and forward", async () => {
	const user = userEvent.setup();
	await persistBrowserNotes([
		note({ id: "history-note", title: "History note" }),
	]);
	render(
		<MemoryRouter initialEntries={["/"]}>
			<NavigationControls />
			<App />
		</MemoryRouter>,
	);

	await user.click(
		await screen.findByRole("button", { name: "Open note History note" }),
	);
	expect(screen.getByLabelText("Current route")).toHaveTextContent(
		"/editor/history-note",
	);
	await user.click(screen.getByRole("button", { name: "History back" }));
	expect(
		await screen.findByRole("main", { name: "Notes" }),
	).toBeInTheDocument();
	await user.click(screen.getByRole("button", { name: "History forward" }));
	expect(await screen.findByLabelText("Title")).toHaveValue("History note");
});

it("opens and closes narrow shell navigation", async () => {
	const user = userEvent.setup();
	render(
		<MemoryRouter>
			<App />
		</MemoryRouter>,
	);
	const drawer = await screen.findByLabelText("Keeper navigation and filters");
	expect(drawer).not.toHaveClass("drawer--open");
	await user.click(screen.getByRole("button", { name: "Open filters" }));
	expect(drawer).toHaveClass("drawer--open");
	await user.click(screen.getByRole("button", { name: "Close navigation" }));
	expect(drawer).not.toHaveClass("drawer--open");
});

it("keeps canonical keyboard shortcuts for search and note creation", async () => {
	render(
		<MemoryRouter>
			<App />
		</MemoryRouter>,
	);
	const search = await screen.findByLabelText("Search notes");
	fireEvent.keyDown(document, {
		key: "k",
		code: "KeyK",
		ctrlKey: true,
	});
	expect(search).toHaveFocus();

	fireEvent.keyDown(document, {
		key: "n",
		code: "KeyN",
		ctrlKey: true,
	});
	expect(await screen.findByLabelText("Title")).toHaveValue("");
	expect(useTabStore.getState().tabs).toHaveLength(1);
});

function renderHomeWithLoader(loadNotes: () => Promise<BrowserNote[]>) {
	return render(
		<ThemeProvider value={lightTheme}>
			<MemoryRouter>
				<BrowserNotesProvider loadNotes={loadNotes}>
					<ViteAppShell>
						<Routes>
							<Route path="/" element={<HomeRoute />} />
						</Routes>
					</ViteAppShell>
				</BrowserNotesProvider>
			</MemoryRouter>
		</ThemeProvider>,
	);
}

it("renders loading, error, and empty home states", async () => {
	const never = new Promise<BrowserNote[]>(() => {});
	const loadingView = renderHomeWithLoader(() => never);
	expect(screen.getByLabelText("Loading notes")).toBeInTheDocument();
	loadingView.unmount();

	const loadFailure = vi
		.fn()
		.mockRejectedValue(new Error("Storage unavailable"));
	const errorView = renderHomeWithLoader(loadFailure);
	expect(await screen.findByText("Storage unavailable")).toBeInTheDocument();
	expect(screen.getByText("Retry")).toBeInTheDocument();
	errorView.unmount();

	renderHomeWithLoader(async () => []);
	expect(await screen.findByText("No notes found")).toBeInTheDocument();
});
