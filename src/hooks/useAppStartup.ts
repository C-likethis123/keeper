import { runStartupStrategy } from "@/services/startup/startupStrategies";
import { traceStartupBootstrapEvent } from "@/services/startup/startupTelemetry";
import { useEffect, useState } from "react";

type StartupStatus = "idle" | "running" | "ready" | "error";

interface AppStartupState {
	isHydrated: boolean;
	initError: string | null;
	status: StartupStatus;
	statusMessage: string;
}

let hasTracedHookEntry = false;
let hasTracedEffectStart = false;

function getExecutionContext(): "server" | "client" {
	return typeof window === "undefined" || typeof document === "undefined"
		? "server"
		: "client";
}

export function useAppStartup(): AppStartupState {
	if (!hasTracedHookEntry) {
		hasTracedHookEntry = true;
		traceStartupBootstrapEvent("bootstrap.use_app_startup_hook_entered", {
			executionContextNote:
				getExecutionContext() === "server"
					? "SSR render cannot detect Tauri globals"
					: undefined,
		});
	}
	const [state, setState] = useState<AppStartupState>({
		isHydrated: false,
		initError: null,
		status: "idle",
		statusMessage: "",
	});

	useEffect(() => {
		if (!hasTracedEffectStart) {
			hasTracedEffectStart = true;
			traceStartupBootstrapEvent("bootstrap.use_app_startup_effect_started");
		}
		let isCancelled = false;
		const safeSetState = (
			updater: (prev: AppStartupState) => AppStartupState,
		) => {
			if (!isCancelled) {
				setState(updater);
			}
		};

		safeSetState((prev) => ({
			...prev,
			status: "running",
		}));
		traceStartupBootstrapEvent("bootstrap.run_startup_strategy_invoked");

		void runStartupStrategy({
			setHydrated: () =>
				safeSetState((prev) => ({
					...prev,
					isHydrated: true,
					status: prev.initError ? "error" : "ready",
					statusMessage: "",
				})),
			setInitError: (error) =>
				safeSetState((prev) => ({
					...prev,
					initError: error,
					status: "error",
				})),
			setStatusMessage: (message) =>
				safeSetState((prev) => ({ ...prev, statusMessage: message })),
		}).catch((error) => {
			console.error("[App] Startup error:", error);
			safeSetState((prev) => ({
				...prev,
				isHydrated: true,
				status: "error",
				initError:
					prev.initError ??
					(error instanceof Error
						? error.message
						: "Startup failed unexpectedly."),
			}));
		});

		return () => {
			isCancelled = true;
		};
	}, []);

	return state;
}
