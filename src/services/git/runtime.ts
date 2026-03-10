import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { hasRustGitNativeBridge } from "@/services/git/native/rustGitNativeModule";
import { getTauriInvoke } from "@/services/storage/runtime";

export type GitRuntime = "desktop-tauri" | "mobile-native" | "unsupported";

export interface GitRuntimeSupport {
	runtime: GitRuntime;
	supported: boolean;
	reason?: string;
}

export function getGitRuntime(): GitRuntime {
	if (getTauriInvoke() !== null) {
		return "desktop-tauri";
	}

	if (Platform.OS !== "web" && hasRustGitNativeBridge()) {
		return "mobile-native";
	}

	return "unsupported";
}

export function getGitRuntimeSupport(): GitRuntimeSupport {
	const runtime = getGitRuntime();
	if (runtime !== "unsupported") {
		return {
			runtime,
			supported: true,
		};
	}

	if (Platform.OS === "web") {
		return {
			runtime,
			supported: false,
			reason: "Git sync is unavailable on web.",
		};
	}

	if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
		return {
			runtime,
			supported: false,
			reason:
				"Git sync is unavailable in Expo Go. Use a native development build or release build.",
		};
	}

	return {
		runtime,
		supported: false,
		reason:
			"Rust git engine is unavailable in this native runtime. Rebuild the app with the Keeper git bridge enabled.",
	};
}
