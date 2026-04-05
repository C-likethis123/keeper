import type { GitEngine } from "@/services/git/engines/GitEngine";
import {
	RustGitEngine,
	isRustGitEngineAvailable,
} from "@/services/git/engines/RustGitEngine";
import { getGitRuntimeSupport } from "@/services/git/runtime";

export function getGitEngine(): GitEngine {
	if (!isRustGitEngineAvailable()) {
		const support = getGitRuntimeSupport();
		throw new Error(
			support.reason ??
				"Rust git engine unavailable. This runtime does not support git sync.",
		);
	}

	return new RustGitEngine();
}
