import type { GitEngine } from "@/services/git/engines/GitEngine";
import { NOTES_ROOT } from "@/services/notes/Notes";
import type { StartupTelemetry } from "@/services/startup/startupTelemetry";
import type {
	GitSyncStateStore,
	MainReconcileResult,
	MainReconcileService,
} from "./types";

const MAX_PUSH_ATTEMPTS = 3;

export class DefaultMainReconcileService implements MainReconcileService {
	constructor(
		private readonly gitEngine: GitEngine,
		private readonly stateStore: GitSyncStateStore,
	) {}

	async reconcile(_telemetry: StartupTelemetry): Promise<MainReconcileResult> {
		return { success: true, usedFastForward: false };
	}
}
