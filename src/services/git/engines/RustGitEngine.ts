import type {
	GitChangedPaths,
	GitCheckoutOptions,
	GitConflictFile,
	GitEngine,
	GitMergeOptions,
	GitStatusItem,
	ConflictResolutionStrategy,
} from "@/services/git/engines/GitEngine";
import {
	getRustGitNativeBridge,
	hasRustGitNativeBridge,
} from "@/services/git/native/rustGitNativeModule";

type TauriInvoke = <T = unknown>(
	command: string,
	args?: Record<string, unknown>,
) => Promise<T>;

interface RustNativeBridge {
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
	status(repoPath: string): Promise<GitStatusItem[]>;
	resolveHeadOid(repoPath: string): Promise<string>;
	changedMarkdownPaths(
		repoPath: string,
		fromOid: string,
		toOid: string,
	): Promise<GitChangedPaths>;
	getConflictedFiles(repoPath: string): Promise<GitConflictFile[]>;
	resolveConflict(
		repoPath: string,
		path: string,
		strategy: string,
		manualContent: string | null,
	): Promise<void>;
	hasUnresolvedConflicts(repoPath: string): Promise<boolean>;
}

type RustBridge =
	| {
			kind: "tauri";
			invoke: TauriInvoke;
	  }
	| {
			kind: "native";
			module: RustNativeBridge;
	  };

function getTauriInvoke(): TauriInvoke | null {
	const tauriInternals = (
		globalThis as {
			__TAURI_INTERNALS__?: {
				invoke?: TauriInvoke;
			};
		}
	).__TAURI_INTERNALS__;

	if (typeof tauriInternals?.invoke === "function") {
		return tauriInternals.invoke;
	}

	return null;
}

export function isRustGitEngineAvailable(): boolean {
	return getTauriInvoke() !== null || hasRustGitNativeBridge();
}

function uriToGitPath(uri: string): string {
	// Remove file:// or file:/// prefix
	let path = uri.replace(/^file:\/\//, "");
	// Ensure leading slash for absolute paths
	if (!path.startsWith("/")) {
		path = `/${path}`;
	}
	return path;
}

export class RustGitEngine implements GitEngine {
	private readonly bridge: RustBridge;

	constructor() {
		const invoke = getTauriInvoke();
		if (invoke) {
			this.bridge = {
				kind: "tauri",
				invoke,
			};
			return;
		}

		if (hasRustGitNativeBridge()) {
			this.bridge = {
				kind: "native",
				module: getRustGitNativeBridge(),
			};
			return;
		}

		throw new Error("RustGitEngine is unavailable in this runtime");
	}

	clone(url: string, dir: string): Promise<void> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke("git_clone_repo", { url, path: dir });
		}
		// Convert file:// URI to absolute path for Rust git bridge
		return this.bridge.module.clone(url, uriToGitPath(dir));
	}

	fetch(dir: string): Promise<void> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke("git_fetch_repo", { repoPath: dir });
		}
		return this.bridge.module.fetch(uriToGitPath(dir));
	}

	checkout(
		dir: string,
		ref: string,
		options?: GitCheckoutOptions,
	): Promise<void> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke("git_checkout_repo", {
				repoPath: dir,
				reference: ref,
				force: options?.force,
				noUpdateHead: options?.noUpdateHead,
			});
		}
		return this.bridge.module.checkout(uriToGitPath(dir), ref, options);
	}

	currentBranch(dir: string): Promise<string | undefined> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke<string | undefined>("git_current_branch_repo", {
				repoPath: dir,
			});
		}
		return this.bridge.module.currentBranch(uriToGitPath(dir));
	}

	listBranches(dir: string, remote?: string): Promise<string[]> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke<string[]>("git_list_branches_repo", {
				repoPath: dir,
				remote,
			});
		}
		return this.bridge.module.listBranches(uriToGitPath(dir), remote);
	}

	merge(dir: string, options: GitMergeOptions): Promise<void> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke("git_merge_repo", {
				repoPath: dir,
				ours: options.ours,
				theirs: options.theirs,
				fastForwardOnly: options.fastForwardOnly,
				authorName: options.author?.name,
				authorEmail: options.author?.email,
				message: options.message,
			});
		}
		return this.bridge.module.merge(uriToGitPath(dir), options);
	}

	commit(dir: string, message: string): Promise<void> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke("git_commit_repo", { repoPath: dir, message });
		}
		return this.bridge.module.commit(uriToGitPath(dir), message);
	}

	push(dir: string): Promise<void> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke("git_push_repo", { repoPath: dir });
		}
		return this.bridge.module.push(uriToGitPath(dir));
	}

	status(dir: string): Promise<GitStatusItem[]> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke<GitStatusItem[]>("git_status_repo", {
				repoPath: dir,
			});
		}
		return this.bridge.module.status(uriToGitPath(dir));
	}

	resolveHeadOid(dir: string): Promise<string> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke<string>("git_head_oid_repo", {
				repoPath: dir,
			});
		}
		return this.bridge.module.resolveHeadOid(uriToGitPath(dir));
	}

	changedMarkdownPaths(
		dir: string,
		fromOid: string,
		toOid: string,
	): Promise<GitChangedPaths> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke<GitChangedPaths>(
				"git_changed_markdown_paths_repo",
				{
					repoPath: dir,
					fromOid,
					toOid,
				},
			);
		}
		return this.bridge.module.changedMarkdownPaths(
			uriToGitPath(dir),
			fromOid,
			toOid,
		);
	}

	getConflictedFiles(dir: string): Promise<GitConflictFile[]> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke<GitConflictFile[]>("git_conflicted_files_repo", {
				repoPath: dir,
			});
		}
		return this.bridge.module.getConflictedFiles(uriToGitPath(dir));
	}

	resolveConflict(
		dir: string,
		path: string,
		strategy: ConflictResolutionStrategy,
		manualContent?: string,
	): Promise<void> {
		const gitPath = uriToGitPath(dir);
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke("git_resolve_conflict_repo", {
				repoPath: gitPath,
				path,
				strategy,
				manualContent: manualContent ?? null,
			});
		}
		return this.bridge.module.resolveConflict(
			gitPath,
			path,
			strategy,
			manualContent ?? null,
		);
	}

	hasUnresolvedConflicts(dir: string): Promise<boolean> {
		if (this.bridge.kind === "tauri") {
			return this.bridge.invoke<boolean>("git_has_unresolved_conflicts_repo", {
				repoPath: dir,
			});
		}
		return this.bridge.module.hasUnresolvedConflicts(uriToGitPath(dir));
	}
}
