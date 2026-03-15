import type { GitRuntimeSupport } from "@/services/git/runtime";
import { checkForUpdates } from "@/utils/checkForUpdates";
import {
	initializeGitStep,
	initializeStorageStep,
	initializeUnsupportedRuntimeStep,
} from "./startupSteps";

type ShowToast = (message: string, duration?: number) => void;

interface StartupStrategyContext {
	runtimeSupport: GitRuntimeSupport;
	showToast: ShowToast;
	setHydrated: () => void;
	setInitError: (error: string) => void;
}

type StartupStrategy = (context: StartupStrategyContext) => Promise<void>;

const runDesktopStartup: StartupStrategy = async ({
	showToast,
	setHydrated,
	setInitError,
}) => {
	setHydrated();
	await initializeStorageStep(showToast);
	void initializeGitStep({
		backgroundMode: true,
		showToast,
		setInitError,
	});
};

const runMobileStartup: StartupStrategy = async ({
	showToast,
	setHydrated,
	setInitError,
}) => {
	await initializeStorageStep(showToast);
	await initializeGitStep({
		backgroundMode: false,
		showToast,
		setInitError,
	});
	setHydrated();
};

const runUnsupportedStartup: StartupStrategy = async ({
	runtimeSupport,
	showToast,
	setHydrated,
}) => {
	await initializeStorageStep(showToast);
	await initializeUnsupportedRuntimeStep(runtimeSupport, showToast);
	setHydrated();
};

const startupStrategies: Record<GitRuntimeSupport["runtime"], StartupStrategy> = {
	"desktop-tauri": runDesktopStartup,
	"mobile-native": runMobileStartup,
	unsupported: runUnsupportedStartup,
};

export async function runStartupStrategy(
	context: StartupStrategyContext,
): Promise<void> {
	const appStartTime = performance.now();
	if (!__DEV__) {
		void checkForUpdates();
	}
	const run = startupStrategies[context.runtimeSupport.runtime];
	await run(context);
	const totalMs = Math.round(performance.now() - appStartTime);
	console.log(`[App] Startup: complete, total ${totalMs}ms`);
}
