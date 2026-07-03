import type { GitEngine } from "./engines/GitEngine";
import { getGitEngine } from "./GitEngine";

export interface GitNativeBridge {
	getEngine(): GitEngine;
}

export class DefaultGitNativeBridge implements GitNativeBridge {
	private gitEngine: GitEngine | null = null;

	getEngine(): GitEngine {
		if (!this.gitEngine) {
			this.gitEngine = getGitEngine();
		}
		return this.gitEngine;
	}
}
