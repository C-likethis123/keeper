import { showToast } from "@/services/toast";

export function isSyncDebugEnabled(): boolean {
	return process.env.EXPO_PUBLIC_SYNC_DEBUG === "true";
}

export function showSyncDebugToast(message: string, duration = 5000): void {
	if (!isSyncDebugEnabled()) return;
	showToast(message, duration);
}
