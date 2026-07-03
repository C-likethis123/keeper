import { checkForUpdates } from "@/utils/checkForUpdates";
import {
	initializeGitStep,
	initializeStorageStep,
} from "./startupSteps";
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

type StartupStrategy = (context: StartupStrategyContext) => Promise<void>;

const runMobileStartup: StartupStrategy = async ({
	setHydrated,
	setInitError,
	setStatusMessage,
	telemetry,
}) => {
	await initializeStorageStep(telemetry);
	await initializeGitStep(
		{
			backgroundMode: false,
			setInitError,
			setStatusMessage,
		},
		telemetry,
	);
	const hydrationStart = telemetry.stepStarted("mobile.hydrate_ui");
	setHydrated();
	telemetry.stepCompleted("mobile.hydrate_ui", hydrationStart);
};

export async function runStartupStrategy(
	context: Omit<StartupStrategyContext, "telemetry">,
): Promise<void> {
	const appStartTime = performance.now();
	const telemetry = createStartupTelemetry("mobile-native");
	telemetry.trace("startup_run_started", { platform: "mobile" });
	if (!__DEV__) {
		void checkForUpdates(context.setStatusMessage);
	}
	try {
		await runMobileStartup({
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
