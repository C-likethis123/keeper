import type { GitEngine } from "@/services/git/engines/GitEngine";
import {
	RustGitEngine,
	isRustGitEngineAvailable,
} from "@/services/git/engines/RustGitEngine";

export function getGitEngine(): GitEngine {
	if (!isRustGitEngineAvailable()) {
		throw new Error(
			"Rust git engine is unavailable in this native runtime. Rebuild the app with the Keeper git bridge enabled.",
		);
	}

	return new RustGitEngine();
}
