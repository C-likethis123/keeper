import { runStartupStrategy } from "@/services/startup/startupStrategies";
import { traceStartupBootstrapEvent } from "@/services/startup/startupTelemetry";
import {
	startSyncPullService,
	stopSyncPullService,
} from "@/services/sync/syncPullService";
import { startSyncPushService } from "@/services/sync/syncPushService";
import { queueMissingLegacyNotes } from "@/services/sync/syncLegacyBackfillService";
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

		let isStorageReady = false;
		const startSync = () => {
			if (!isStorageReady) return;
			// Do not hold normal sync behind the legacy scan. A large desktop vault
			// can take long enough that newly saved notes otherwise sit unsent.
			startSyncPushService();
			startSyncPullService();
			void queueMissingLegacyNotes().then((queued) => {
				if (queued > 0) startSyncPushService();
			});
		};

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
		})
			.then(() => {
				isStorageReady = true;
				startSync();
			})
			.catch((error) => {
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

		const handleOnline = () => {
			startSync();
		};
		const canListenForOnline =
			typeof window !== "undefined" &&
			typeof window.addEventListener === "function" &&
			typeof window.removeEventListener === "function";
		if (canListenForOnline) {
			window.addEventListener("online", handleOnline);
		}

		return () => {
			isCancelled = true;
			stopSyncPullService();
			if (
				typeof window !== "undefined" &&
				typeof window.removeEventListener === "function"
			) {
				window.removeEventListener("online", handleOnline);
			}
		};
	}, []);

	return state;
}
