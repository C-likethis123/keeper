import type { GitRuntimeSupport } from "@/services/git/runtime";
import { checkForUpdates } from "@/utils/checkForUpdates";
import { createStartupTelemetry, type StartupTelemetry } from "./startupTelemetry";
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
	telemetry: StartupTelemetry;
}

type StartupStrategy = (context: StartupStrategyContext) => Promise<void>;

const runDesktopStartup: StartupStrategy = async ({
	showToast,
	setHydrated,
	setInitError,
	telemetry,
}) => {
	await initializeStorageStep(telemetry);
	const hydrationStart = telemetry.stepStarted("desktop.hydrate_ui");
	setHydrated();
	telemetry.stepCompleted("desktop.hydrate_ui", hydrationStart);
	void initializeGitStep(
		{
			backgroundMode: true,
			showToast,
			setInitError,
		},
		telemetry,
	);
};

const runMobileStartup: StartupStrategy = async ({
	showToast,
	setHydrated,
	setInitError,
	telemetry,
}) => {
	await initializeStorageStep(telemetry);
	await initializeGitStep(
		{
			backgroundMode: false,
			showToast,
			setInitError,
		},
		telemetry,
	);
	const hydrationStart = telemetry.stepStarted("mobile.hydrate_ui");
	setHydrated();
	telemetry.stepCompleted("mobile.hydrate_ui", hydrationStart);
};

const runUnsupportedStartup: StartupStrategy = async ({
	runtimeSupport,
	showToast,
	setHydrated,
	telemetry,
}) => {
	await initializeStorageStep(telemetry);
	await initializeUnsupportedRuntimeStep(runtimeSupport, showToast, telemetry);
	const hydrationStart = telemetry.stepStarted("unsupported.hydrate_ui");
	setHydrated();
	telemetry.stepCompleted("unsupported.hydrate_ui", hydrationStart);
};

const startupStrategies: Record<GitRuntimeSupport["runtime"], StartupStrategy> = {
	"desktop-tauri": runDesktopStartup,
	"mobile-native": runMobileStartup,
	unsupported: runUnsupportedStartup,
};

export async function runStartupStrategy(
	context: Omit<StartupStrategyContext, "telemetry">,
): Promise<void> {
	const appStartTime = performance.now();
	const telemetry = createStartupTelemetry(context.runtimeSupport.runtime);
	telemetry.trace("startup_run_started", {
		supported: context.runtimeSupport.supported,
	});
	if (!__DEV__) {
		void checkForUpdates();
	}
	const run = startupStrategies[context.runtimeSupport.runtime];
	try {
		await run({
			...context,
			telemetry,
		});
		const totalMs = Math.round(performance.now() - appStartTime);
		telemetry.trace("startup_run_completed", {
			totalMs,
		});
		console.log(`[App] Startup: complete, total ${totalMs}ms`);
	} catch (error) {
		telemetry.trace("startup_run_failed", {
			errorMessage: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}
