let mockDirectoryExists = false;
let mockDirectoryEntries: unknown[] = [];

jest.mock("expo-file-system", () => ({
	__esModule: true,
	Paths: {
		cache: { uri: "file:///tmp/" },
		document: { uri: "file:///tmp/" },
	},
	Directory: class Directory {
		exists = mockDirectoryExists;

		list() {
			return mockDirectoryEntries;
		}
	},
	File: class File {},
}));

jest.mock("@/services/storage/runtime", () => ({
	isTauriRuntime: jest.fn().mockReturnValue(false),
}));

import type { GitEngine } from "@/services/git/engines/GitEngine";
import { DefaultRepoBootstrapper } from "@/services/git/init/repoBootstrapper";
import { isTauriRuntime } from "@/services/storage/runtime";

describe("DefaultRepoBootstrapper.validateRepository", () => {
	const gitEngine = {
		resolveHeadOid: jest.fn(),
	} as unknown as GitEngine;

	const bootstrapper = new DefaultRepoBootstrapper(
		gitEngine,
		{
			owner: "owner",
			repo: "repo",
			token: "token",
		},
		{
			resolveCloneFailure: jest.fn(),
		},
	);

	beforeEach(() => {
		mockDirectoryExists = false;
		mockDirectoryEntries = [];
		(isTauriRuntime as jest.Mock).mockReturnValue(false);
		jest.clearAllMocks();
	});

	it("marks a non-empty notes directory as existing when git validation fails", async () => {
		gitEngine.resolveHeadOid = jest
			.fn()
			.mockRejectedValue(new Error("not a git repository"));
		mockDirectoryExists = true;
		mockDirectoryEntries = [{}];

		const result = await bootstrapper.validateRepository();

		expect(result).toEqual({
			exists: true,
			isValid: false,
			reason: "not a git repository",
		});
	});

	it("allows clone to proceed when the notes directory is missing or empty", async () => {
		gitEngine.resolveHeadOid = jest.fn().mockRejectedValue(new Error("missing"));
		mockDirectoryExists = true;
		mockDirectoryEntries = [];

		const result = await bootstrapper.validateRepository();

		expect(result).toEqual({
			exists: false,
			isValid: false,
			reason: "missing",
		});
	});
});

describe("DefaultRepoBootstrapper.validateRepository on desktop (Tauri)", () => {
	const gitEngine = {
		resolveHeadOid: jest.fn(),
	} as unknown as GitEngine;

	const bootstrapper = new DefaultRepoBootstrapper(
		gitEngine,
		{ owner: "owner", repo: "repo", token: "token" },
		{ resolveCloneFailure: jest.fn() },
	);

	beforeEach(() => {
		(isTauriRuntime as jest.Mock).mockReturnValue(true);
		jest.clearAllMocks();
	});

	it("reports exists: false when git validation fails on desktop (skips directory check)", async () => {
		gitEngine.resolveHeadOid = jest
			.fn()
			.mockRejectedValue(new Error("repository not found"));

		const result = await bootstrapper.validateRepository();

		expect(result).toEqual({
			exists: false,
			isValid: false,
			reason: "repository not found",
		});
	});
});
