import type { GitConflictFile } from "@/services/git/engines/GitEngine";
import { useConflictStore } from "../conflictStore";

function makeConflict(
	path: string,
	overrides?: Partial<GitConflictFile>,
): GitConflictFile {
	return {
		path,
		baseContent: overrides?.baseContent ?? null,
		oursContent: overrides?.oursContent ?? null,
		theirsContent: overrides?.theirsContent ?? null,
	};
}

describe("useConflictStore", () => {
	beforeEach(() => {
		useConflictStore.setState({
			conflicts: [],
			lastDetectedAt: null,
			isResolving: false,
		});
	});

	describe("setConflicts", () => {
		it("stores conflicts with resolved=false", () => {
			const conflicts = [makeConflict("a.md"), makeConflict("b.md")];
			useConflictStore.getState().setConflicts(conflicts);
			const state = useConflictStore.getState();
			expect(state.conflicts).toHaveLength(2);
			expect(state.conflicts[0].resolved).toBe(false);
			expect(state.lastDetectedAt).not.toBeNull();
		});

		it("updates lastDetectedAt timestamp", () => {
			const before = Date.now();
			useConflictStore.getState().setConflicts([makeConflict("x.md")]);
			const after = Date.now();
			const { lastDetectedAt } = useConflictStore.getState();
			expect(lastDetectedAt).toBeGreaterThanOrEqual(before);
			expect(lastDetectedAt).toBeLessThanOrEqual(after);
		});
	});

	describe("markResolved", () => {
		beforeEach(() => {
			useConflictStore
				.getState()
				.setConflicts([makeConflict("a.md"), makeConflict("b.md")]);
		});

		it("marks a single conflict as resolved", () => {
			useConflictStore.getState().markResolved("a.md", "ours");
			const state = useConflictStore.getState();
			expect(state.conflicts[0].resolved).toBe(true);
			expect(state.conflicts[0].resolutionStrategy).toBe("ours");
			expect(state.conflicts[1].resolved).toBe(false);
		});

		it("does not affect other conflicts", () => {
			useConflictStore.getState().markResolved("a.md", "theirs");
			const state = useConflictStore.getState();
			expect(state.conflicts[1].resolved).toBe(false);
		});
	});

	describe("markAllResolved", () => {
		beforeEach(() => {
			useConflictStore
				.getState()
				.setConflicts([makeConflict("a.md"), makeConflict("b.md")]);
		});

		it("marks all conflicts as resolved", () => {
			useConflictStore.getState().markAllResolved("base");
			const state = useConflictStore.getState();
			expect(state.conflicts.every((c) => c.resolved)).toBe(true);
		});

		it("sets the strategy on all conflicts", () => {
			useConflictStore.getState().markAllResolved("theirs");
			const state = useConflictStore.getState();
			expect(
				state.conflicts.every((c) => c.resolutionStrategy === "theirs"),
			).toBe(true);
		});
	});

	describe("clearConflicts", () => {
		beforeEach(() => {
			useConflictStore.getState().setConflicts([makeConflict("a.md")]);
		});

		it("clears all conflicts", () => {
			useConflictStore.getState().clearConflicts();
			expect(useConflictStore.getState().conflicts).toHaveLength(0);
		});

		it("clears lastDetectedAt", () => {
			useConflictStore.getState().clearConflicts();
			expect(useConflictStore.getState().lastDetectedAt).toBeNull();
		});
	});

	describe("hasUnresolvedConflicts", () => {
		it("returns false when no conflicts", () => {
			expect(useConflictStore.getState().hasUnresolvedConflicts()).toBe(false);
		});

		it("returns true when unresolved conflicts exist", () => {
			useConflictStore.getState().setConflicts([makeConflict("a.md")]);
			expect(useConflictStore.getState().hasUnresolvedConflicts()).toBe(true);
		});

		it("returns false when all conflicts are resolved", () => {
			useConflictStore.getState().setConflicts([makeConflict("a.md")]);
			useConflictStore.getState().markResolved("a.md", "ours");
			expect(useConflictStore.getState().hasUnresolvedConflicts()).toBe(false);
		});
	});

	describe("getUnresolvedCount", () => {
		it("returns 0 when no conflicts", () => {
			expect(useConflictStore.getState().getUnresolvedCount()).toBe(0);
		});

		it("returns count of unresolved conflicts", () => {
			useConflictStore
				.getState()
				.setConflicts([makeConflict("a.md"), makeConflict("b.md")]);
			useConflictStore.getState().markResolved("a.md", "ours");
			expect(useConflictStore.getState().getUnresolvedCount()).toBe(1);
		});
	});
});
