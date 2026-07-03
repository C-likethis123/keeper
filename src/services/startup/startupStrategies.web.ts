import { checkForUpdates } from "@/utils/checkForUpdates";
import { initializeGitStep, initializeStorageStep } from "./startupSteps";
import {
	type StartupTelemetry,
	createStartupTelemetry,
} from "./startupTelemetry";

interface StartupStrategyContext {
	setHydrated: () => void;
	setInitError: (error: string) => void;
	setStatusMessage: (message: string) => void;
	telemetry: StartupTelemetry;
}

async function runDesktopStartup({
	setHydrated,
	setInitError,
	setStatusMessage,
	telemetry,
}: StartupStrategyContext): Promise<void> {
	await initializeStorageStep(telemetry);
	const hydrationStart = telemetry.stepStarted("desktop.hydrate_ui");
	setHydrated();
	telemetry.stepCompleted("desktop.hydrate_ui", hydrationStart);
	void initializeGitStep(
		{
			backgroundMode: true,
			setInitError,
			setStatusMessage,
		},
		telemetry,
	);
}

export async function runStartupStrategy(
	context: Omit<StartupStrategyContext, "telemetry">,
): Promise<void> {
	const appStartTime = performance.now();
	const telemetry = createStartupTelemetry("desktop-tauri");
	telemetry.trace("startup_run_started", {
		platform: "web",
	});
	if (!__DEV__) {
		void checkForUpdates(context.setStatusMessage);
	}

	try {
		await runDesktopStartup({ ...context, telemetry });
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
