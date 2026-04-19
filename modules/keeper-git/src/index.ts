import { requireOptionalNativeModule } from "expo-modules-core";

interface GitCheckoutOptions {
	force?: boolean;
	noUpdateHead?: boolean;
}

interface GitMergeOptions {
	ours: string;
	theirs: string;
	fastForwardOnly?: boolean;
	message?: string;
	author?: {
		name: string;
		email: string;
	};
}

interface KeeperGitBridgeNativeModule {
	clone(url: string, path: string): Promise<void>;
	fetch(repoPath: string): Promise<void>;
	checkout(
		repoPath: string,
		reference: string,
		options?: GitCheckoutOptions,
	): Promise<void>;
	currentBranch(repoPath: string): Promise<string | undefined>;
	listBranches(repoPath: string, remote?: string): Promise<string[]>;
	merge(repoPath: string, options: GitMergeOptions): Promise<void>;
	commit(repoPath: string, message: string): Promise<void>;
	push(repoPath: string): Promise<void>;
	status(repoPath: string): Promise<unknown>;
	resolveHeadOid(repoPath: string): Promise<string>;

	changedMarkdownPaths(
		repoPath: string,
		fromOid: string,
		toOid: string,
	): Promise<unknown>;
	changedPaths(
		repoPath: string,
		fromOid: string,
		toOid: string,
	): Promise<unknown>;
	getConflictedFiles(repoPath: string): Promise<unknown>;
	resolveConflict(
		repoPath: string,
		path: string,
		strategy: string,
		manualContent: string | null,
	): Promise<void>;
	hasUnresolvedConflicts(repoPath: string): Promise<boolean>;
}

export default requireOptionalNativeModule<KeeperGitBridgeNativeModule>(
	"KeeperGitBridge",
);
