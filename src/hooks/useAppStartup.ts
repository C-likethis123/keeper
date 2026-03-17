import { getGitRuntimeSupport } from "@/services/git/runtime";
import { traceStartupBootstrapEvent } from "@/services/startup/startupTelemetry";
import { runStartupStrategy } from "@/services/startup/startupStrategies";
import { useToastStore } from "@/stores/toastStore";
import { useEffect, useState } from "react";

type StartupStatus = "idle" | "running" | "ready" | "error";

interface AppStartupState {
	isHydrated: boolean;
	initError: string | null;
	runtime: ReturnType<typeof getGitRuntimeSupport>["runtime"];
	status: StartupStatus;
}

const initialRuntime = getGitRuntimeSupport().runtime;
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
			initialRuntime,
			executionContextNote:
				getExecutionContext() === "server"
					? "SSR render cannot detect Tauri globals"
					: undefined,
		});
	}
	const showToast = useToastStore((state) => state.showToast);
	const [state, setState] = useState<AppStartupState>({
		isHydrated: false,
		initError: null,
		runtime: initialRuntime,
		status: "idle",
	});

	useEffect(() => {
		if (!hasTracedEffectStart) {
			hasTracedEffectStart = true;
			traceStartupBootstrapEvent("bootstrap.use_app_startup_effect_started");
		}
		let isCancelled = false;
		const safeSetState = (updater: (prev: AppStartupState) => AppStartupState) => {
			if (!isCancelled) {
				setState(updater);
			}
		};
		const runtimeSupport = getGitRuntimeSupport();
		traceStartupBootstrapEvent("bootstrap.runtime_support_resolved", {
			runtime: runtimeSupport.runtime,
			supported: runtimeSupport.supported,
		});

		safeSetState((prev) => ({
			...prev,
			runtime: runtimeSupport.runtime,
			status: "running",
		}));
		traceStartupBootstrapEvent("bootstrap.run_startup_strategy_invoked", {
			runtime: runtimeSupport.runtime,
		});

		void runStartupStrategy({
			runtimeSupport,
			showToast,
			setHydrated: () =>
				safeSetState((prev) => ({
					...prev,
					isHydrated: true,
					status: prev.initError ? "error" : "ready",
				})),
			setInitError: (error) =>
				safeSetState((prev) => ({
					...prev,
					initError: error,
					status: "error",
				})),
		}).catch((error) => {
			console.error("[App] Startup error:", error);
			safeSetState((prev) => ({
				...prev,
				isHydrated: true,
				status: "error",
				initError: prev.initError ?? "Startup failed unexpectedly.",
			}));
		});

		return () => {
			isCancelled = true;
		};
	}, [showToast]);

	return state;
}
