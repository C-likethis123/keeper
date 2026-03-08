import { NativeModules } from "react-native";
import type {
	GitChangedPaths,
	GitCheckoutOptions,
	GitMergeOptions,
	GitStatusItem,
} from "@/services/git/engines/GitEngine";

interface KeeperGitBridgeSpec {
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
}

const nativeBridgeRaw =
	NativeModules.KeeperGitBridge as KeeperGitBridgeSpec | undefined;

function parseMaybeJson<T>(payload: unknown): T {
	if (typeof payload === "string") {
		return JSON.parse(payload) as T;
	}
	return payload as T;
}

const nativeBridge: KeeperGitBridgeSpec | undefined = nativeBridgeRaw
	? {
			clone: nativeBridgeRaw.clone.bind(nativeBridgeRaw),
			fetch: nativeBridgeRaw.fetch.bind(nativeBridgeRaw),
			checkout: nativeBridgeRaw.checkout.bind(nativeBridgeRaw),
			currentBranch: async (repoPath: string) =>
				parseMaybeJson<string | undefined>(
					await nativeBridgeRaw.currentBranch(repoPath),
				),
			listBranches: async (repoPath: string, remote?: string) =>
				parseMaybeJson<string[]>(
					await nativeBridgeRaw.listBranches(repoPath, remote),
				),
			merge: nativeBridgeRaw.merge.bind(nativeBridgeRaw),
			commit: nativeBridgeRaw.commit.bind(nativeBridgeRaw),
			push: nativeBridgeRaw.push.bind(nativeBridgeRaw),
			status: async (repoPath: string) =>
				parseMaybeJson<GitStatusItem[]>(await nativeBridgeRaw.status(repoPath)),
			resolveHeadOid: async (repoPath: string) =>
				parseMaybeJson<string>(await nativeBridgeRaw.resolveHeadOid(repoPath)),
			changedMarkdownPaths: async (
				repoPath: string,
				fromOid: string,
				toOid: string,
			) =>
				parseMaybeJson<GitChangedPaths>(
					await nativeBridgeRaw.changedMarkdownPaths(repoPath, fromOid, toOid),
				),
		}
	: undefined;

export function hasRustGitNativeBridge(): boolean {
	return nativeBridge !== undefined;
}

export function getRustGitNativeBridge(): KeeperGitBridgeSpec {
	if (!nativeBridge) {
		throw new Error("KeeperGitBridge native module is unavailable");
	}
	return nativeBridge;
}
