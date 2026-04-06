const mockGetTauriInvoke = jest.fn();

jest.mock("@/services/storage/runtime", () => ({
	getTauriInvoke: () => mockGetTauriInvoke(),
}));

describe("TauriStorageEngine", () => {
	beforeEach(() => {
		jest.resetModules();
		mockGetTauriInvoke.mockReset();
	});

	it("loads notes through the unified read_note command only", async () => {
		const invoke = jest.fn().mockResolvedValue({
			id: "tmpl-1",
			title: "Template",
			content: "body",
			isPinned: false,
			lastUpdated: 123,
			noteType: "template",
			status: null,
		});
		mockGetTauriInvoke.mockReturnValue(invoke);

		const { TauriStorageEngine } = await import("../TauriStorageEngine");
		const engine = new TauriStorageEngine();

		await expect(engine.loadNote("tmpl-1")).resolves.toEqual({
			id: "tmpl-1",
			title: "Template",
			content: "body",
			isPinned: false,
			lastUpdated: 123,
			noteType: "template",
			status: null,
		});
		expect(invoke).toHaveBeenCalledTimes(1);
		expect(invoke).toHaveBeenCalledWith("read_note", { id: "tmpl-1" });
	});

	it("saves templates through the unified write_note command", async () => {
		const invoke = jest.fn().mockResolvedValue(456);
		mockGetTauriInvoke.mockReturnValue(invoke);

		const { TauriStorageEngine } = await import("../TauriStorageEngine");
		const engine = new TauriStorageEngine();

		await expect(
			engine.saveNote({
				id: "tmpl-1",
				title: "Template",
				content: "body",
				isPinned: true,
				noteType: "template",
				status: null,
			}),
		).resolves.toEqual({
			id: "tmpl-1",
			title: "Template",
			content: "body",
			isPinned: false,
			lastUpdated: 456,
			noteType: "template",
			status: null,
		});
		expect(invoke).toHaveBeenCalledWith("write_note", {
			input: {
				id: "tmpl-1",
				title: "Template",
				content: "body",
				isPinned: false,
				noteType: "template",
				status: null,
				attachment: null,
			},
		});
	});

	it("deletes notes through the unified delete_note command only", async () => {
		const invoke = jest.fn().mockResolvedValue(true);
		mockGetTauriInvoke.mockReturnValue(invoke);

		const { TauriStorageEngine } = await import("../TauriStorageEngine");
		const engine = new TauriStorageEngine();

		await expect(engine.deleteNote("tmpl-1")).resolves.toBe(true);
		expect(invoke).toHaveBeenCalledTimes(1);
		expect(invoke).toHaveBeenCalledWith("delete_note", { id: "tmpl-1" });
	});

	it("maps noteTypes filters into the backend noteType field for index queries", async () => {
		const invoke = jest.fn().mockResolvedValue({
			items: [],
			cursor: undefined,
		});
		mockGetTauriInvoke.mockReturnValue(invoke);

		const { TauriStorageEngine } = await import("../TauriStorageEngine");
		const engine = new TauriStorageEngine();

		await engine.indexList("", 100, 0, {
			noteTypes: ["template"],
		});

		expect(invoke).toHaveBeenCalledWith("index_list", {
			input: {
				query: "",
				limit: 100,
				offset: 0,
				filters: {
					noteType: "template",
					status: undefined,
				},
			},
		});
	});
});
