import type { GitConflictFile } from "@/services/git/engines/GitEngine";
import type { GitEngine } from "@/services/git/engines/GitEngine";
import { NOTES_ROOT } from "@/services/notes/Notes";

export interface ConflictInfo {
	files: GitConflictFile[];
	detectedAt: number;
	resolvedCount: number;
}

export class ConflictDetectionService {
	constructor(private readonly gitEngine: GitEngine) {}

	/**
	 * Scan for unresolved conflicts after a failed merge.
	 * Returns the list of conflicted files with their 3 versions.
	 */
	async detectConflicts(): Promise<GitConflictFile[]> {
		return this.gitEngine.getConflictedFiles(NOTES_ROOT);
	}

	/**
	 * Check if there are any unresolved conflicts in the repo.
	 */
	async hasUnresolvedConflicts(): Promise<boolean> {
		return this.gitEngine.hasUnresolvedConflicts(NOTES_ROOT);
	}

	/**
	 * Resolve a single conflict using the specified strategy.
	 * After all conflicts are resolved, a commit should be made.
	 */
	async resolveConflict(
		path: string,
		strategy: "ours" | "theirs" | "base" | "manual",
		manualContent?: string,
	): Promise<void> {
		await this.gitEngine.resolveConflict(
			NOTES_ROOT,
			path,
			strategy,
			manualContent,
		);
	}

	/**
	 * Resolve all conflicts automatically by choosing a strategy for each.
	 * Returns the number of resolved files.
	 */
	async resolveAllConflicts(
		strategy: "ours" | "theirs" | "base",
	): Promise<number> {
		const conflicts = await this.detectConflicts();
		for (const conflict of conflicts) {
			await this.resolveConflict(conflict.path, strategy);
		}
		return conflicts.length;
	}

	/**
	 * Get a human-readable summary of conflicts.
	 */
	getConflictSummary(files: GitConflictFile[]): string {
		if (files.length === 0) return "No conflicts detected";
		if (files.length === 1) return "1 file has a sync conflict";
		return `${files.length} files have sync conflicts`;
	}

	/**
	 * Map conflict file paths to note titles/IDs for display in the UI.
	 * Strips .md extension and path prefixes.
	 */
	static getPathDisplayName(filePath: string): string {
		// Remove .md extension
		const name = filePath.replace(/\.md$/, "");
		// If it's a nested path, show just the filename
		const parts = name.split("/");
		return parts[parts.length - 1] ?? name;
	}
}
