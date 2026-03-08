import type { GitEngine } from "@/services/git/engines/GitEngine";
import {
	isRustGitEngineAvailable,
	RustGitEngine,
} from "@/services/git/engines/RustGitEngine";

export function getGitEngine(): GitEngine {
	if (!isRustGitEngineAvailable()) {
		throw new Error(
			"Rust git engine unavailable. This runtime does not support git sync.",
		);
	}

	return new RustGitEngine();
}
