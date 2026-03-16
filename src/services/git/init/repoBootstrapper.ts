import { NOTES_ROOT } from "@/services/notes/Notes";
import type { GitEngine } from "@/services/git/engines/GitEngine";
import type {
	GitHubConfig,
	GitInitErrorMapper,
	RepoBootstrapper,
	RepositoryValidationResult,
	CloneRepositoryResult,
} from "./types";

export class DefaultRepoBootstrapper implements RepoBootstrapper {
	constructor(
		private readonly gitEngine: GitEngine,
		private readonly config: GitHubConfig,
		private readonly errorMapper: GitInitErrorMapper,
	) {}

	private pickPreferredBranch(branches: string[]): string | undefined {
		if (branches.includes("main")) return "main";
		if (branches.includes("master")) return "master";
		return branches[0];
	}

	async validateRepository(): Promise<RepositoryValidationResult> {
		try {
			await this.gitEngine.resolveHeadOid(NOTES_ROOT);
			return { exists: true, isValid: true };
		} catch (error) {
			console.warn(
				"[GitInitializationService] Error validating repository:",
				error,
			);
			if (error instanceof Error && error.message.includes("permission")) {
				console.error(
					"File system permission error. Ensure app has storage permissions",
				);
			}
			return {
				exists: false,
				isValid: false,
				reason:
					error instanceof Error ? error.message : "Repository not initialized",
			};
		}
	}

	async cloneRepository(): Promise<CloneRepositoryResult> {
		try {
			const url = `https://github.com/${this.config.owner}/${this.config.repo}.git`;
			console.log("[GitInitializationService] Starting clone...");

			await this.gitEngine.clone(url, NOTES_ROOT);

			try {
				console.log(
					"[GitInitializationService] Clone completed, checking out branch...",
				);
				const branches = await this.gitEngine.listBranches(NOTES_ROOT);
				const branchToCheckout = this.pickPreferredBranch(branches) ?? "main";
				await this.gitEngine.checkout(NOTES_ROOT, branchToCheckout);
				console.log(
					`[GitInitializationService] Successfully checked out branch: ${branchToCheckout}`,
				);
			} catch (checkoutError) {
				console.error(
					"[GitInitializationService] Error during checkout:",
					checkoutError,
				);
				console.warn(
					"[GitInitializationService] Checkout failed, but repository may still be usable",
				);
			}

			console.log(
				"[GitInitializationService] Clone and checkout completed, verifying repository...",
			);
			return { success: true };
		} catch (error) {
			const resolution = await this.errorMapper.resolveCloneFailure(error);
			return {
				success: false,
				failureMessage: resolution.failureMessage,
			};
		}
	}
}
