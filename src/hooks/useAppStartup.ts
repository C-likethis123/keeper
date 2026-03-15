import { getGitRuntimeSupport } from "@/services/git/runtime";
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

export function useAppStartup(): AppStartupState {
	const showToast = useToastStore((state) => state.showToast);
	const [state, setState] = useState<AppStartupState>({
		isHydrated: false,
		initError: null,
		runtime: initialRuntime,
		status: "idle",
	});

	useEffect(() => {
		let isCancelled = false;
		const safeSetState = (updater: (prev: AppStartupState) => AppStartupState) => {
			if (!isCancelled) {
				setState(updater);
			}
		};
		const runtimeSupport = getGitRuntimeSupport();

		safeSetState((prev) => ({
			...prev,
			runtime: runtimeSupport.runtime,
			status: "running",
		}));

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
