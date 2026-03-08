export interface GitStatusItem {
	path: string;
	status: string;
}

export interface GitCheckoutOptions {
	force?: boolean;
	noUpdateHead?: boolean;
}

export interface GitMergeAuthor {
	name: string;
	email: string;
}

export interface GitMergeOptions {
	ours: string;
	theirs: string;
	fastForwardOnly?: boolean;
	author?: GitMergeAuthor;
	message?: string;
}

export interface GitChangedPaths {
	added: string[];
	modified: string[];
	deleted: string[];
}

export interface GitEngine {
	clone(url: string, dir: string): Promise<void>;
	fetch(dir: string): Promise<void>;
	checkout(dir: string, ref: string, options?: GitCheckoutOptions): Promise<void>;
	currentBranch(dir: string): Promise<string | undefined>;
	listBranches(dir: string, remote?: string): Promise<string[]>;
	merge(dir: string, options: GitMergeOptions): Promise<void>;
	commit(dir: string, message: string): Promise<void>;
	push(dir: string): Promise<void>;
	status(dir: string): Promise<GitStatusItem[]>;
	resolveHeadOid(dir: string): Promise<string>;
	changedMarkdownPaths(
		dir: string,
		fromOid: string,
		toOid: string,
	): Promise<GitChangedPaths>;
}
