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

import type { GitEngine } from "@/services/git/engines/GitEngine";
import { DefaultRepoBootstrapper } from "@/services/git/init/repoBootstrapper.native";

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
		gitEngine.resolveHeadOid = jest
			.fn()
			.mockRejectedValue(new Error("missing"));
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

