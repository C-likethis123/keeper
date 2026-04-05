import type { GitEngine } from "@/services/git/engines/GitEngine";
import { RustGitEngine } from "@/services/git/engines/RustGitEngine";

export function getGitEngine(): GitEngine {
	return new RustGitEngine();
}
