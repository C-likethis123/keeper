import { ConflictDetectionService } from "../conflictDetectionService";
import type { GitConflictFile, GitEngine } from "../engines/GitEngine";

function makeConflictFile(overrides?: Partial<GitConflictFile>): GitConflictFile {
	return {
		path: overrides?.path ?? "test.md",
		baseContent: overrides?.baseContent ?? null,
		oursContent: overrides?.oursContent ?? null,
		theirsContent: overrides?.theirsContent ?? null,
	};
}

function makeMockEngine(overrides?: Partial<GitEngine>): GitEngine {
	return {
		clone: jest.fn(),
		fetch: jest.fn(),
		checkout: jest.fn(),
		currentBranch: jest.fn(),
		listBranches: jest.fn(),
		merge: jest.fn(),
		commit: jest.fn(),
		push: jest.fn(),
		status: jest.fn(),
		resolveHeadOid: jest.fn(),
		changedMarkdownPaths: jest.fn(),
		getConflictedFiles: jest.fn(),
		resolveConflict: jest.fn(),
		hasUnresolvedConflicts: jest.fn(),
		...overrides,
	};
}

describe("ConflictDetectionService", () => {
	describe("detectConflicts", () => {
		it("returns empty array when no conflicts", async () => {
			const engine = makeMockEngine({
				getConflictedFiles: jest.fn().mockResolvedValue([]),
			});
			const service = new ConflictDetectionService(engine);
			const result = await service.detectConflicts();
			expect(result).toEqual([]);
		});

		it("returns conflicted files from engine", async () => {
			const conflicts = [
				makeConflictFile({ path: "note1.md" }),
				makeConflictFile({ path: "note2.md" }),
			];
			const engine = makeMockEngine({
				getConflictedFiles: jest.fn().mockResolvedValue(conflicts),
			});
			const service = new ConflictDetectionService(engine);
			const result = await service.detectConflicts();
			expect(result).toHaveLength(2);
			expect(result[0].path).toBe("note1.md");
		});
	});

	describe("hasUnresolvedConflicts", () => {
		it("returns false when no conflicts", async () => {
			const engine = makeMockEngine({
				hasUnresolvedConflicts: jest.fn().mockResolvedValue(false),
			});
			const service = new ConflictDetectionService(engine);
			const result = await service.hasUnresolvedConflicts();
			expect(result).toBe(false);
		});

		it("returns true when conflicts exist", async () => {
			const engine = makeMockEngine({
				hasUnresolvedConflicts: jest.fn().mockResolvedValue(true),
			});
			const service = new ConflictDetectionService(engine);
			const result = await service.hasUnresolvedConflicts();
			expect(result).toBe(true);
		});
	});

	describe("resolveConflict", () => {
		it("calls engine resolveConflict with correct params", async () => {
			const resolveMock = jest.fn().mockResolvedValue(undefined);
			const engine = makeMockEngine({
				resolveConflict: resolveMock,
			});
			const service = new ConflictDetectionService(engine);
			await service.resolveConflict("test.md", "theirs");
			expect(resolveMock).toHaveBeenCalledWith(
				expect.any(String),
				"test.md",
				"theirs",
				undefined,
			);
		});

		it("supports manual strategy with content", async () => {
			const resolveMock = jest.fn().mockResolvedValue(undefined);
			const engine = makeMockEngine({
				resolveConflict: resolveMock,
			});
			const service = new ConflictDetectionService(engine);
			await service.resolveConflict("test.md", "manual", "custom content");
			expect(resolveMock).toHaveBeenCalledWith(
				expect.any(String),
				"test.md",
				"manual",
				"custom content",
			);
		});
	});

	describe("resolveAllConflicts", () => {
		it("resolves all conflicts using the specified strategy", async () => {
			const conflicts = [
				makeConflictFile({ path: "a.md" }),
				makeConflictFile({ path: "b.md" }),
			];
			const resolveMock = jest.fn().mockResolvedValue(undefined);
			const engine = makeMockEngine({
				getConflictedFiles: jest.fn().mockResolvedValue(conflicts),
				resolveConflict: resolveMock,
			});
			const service = new ConflictDetectionService(engine);
			const count = await service.resolveAllConflicts("ours");
			expect(count).toBe(2);
			expect(resolveMock).toHaveBeenCalledTimes(2);
			expect(resolveMock).toHaveBeenNthCalledWith(
				1,
				expect.any(String),
				"a.md",
				"ours",
				undefined,
			);
		});
	});

	describe("getConflictSummary", () => {
		it("returns no conflicts message for empty array", () => {
			const service = new ConflictDetectionService(makeMockEngine());
			expect(service.getConflictSummary([])).toBe("No conflicts detected");
		});

		it("returns singular message for one conflict", () => {
			const service = new ConflictDetectionService(makeMockEngine());
			expect(
				service.getConflictSummary([makeConflictFile({ path: "x.md" })]),
			).toBe("1 file has a sync conflict");
		});

		it("returns plural message for multiple conflicts", () => {
			const service = new ConflictDetectionService(makeMockEngine());
			const conflicts = [
				makeConflictFile({ path: "a.md" }),
				makeConflictFile({ path: "b.md" }),
				makeConflictFile({ path: "c.md" }),
			];
			expect(service.getConflictSummary(conflicts)).toBe(
				"3 files have sync conflicts",
			);
		});
	});

	describe("getPathDisplayName", () => {
		it("strips .md extension", () => {
			expect(ConflictDetectionService.getPathDisplayName("note.md")).toBe(
				"note",
			);
		});

		it("returns filename for nested paths", () => {
			expect(
				ConflictDetectionService.getPathDisplayName("folder/sub/note.md"),
			).toBe("note");
		});

		it("handles paths without extension", () => {
			expect(ConflictDetectionService.getPathDisplayName("README")).toBe(
				"README",
			);
		});
	});
});
