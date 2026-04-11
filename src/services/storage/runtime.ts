type TauriInvoke = <T = unknown>(
	command: string,
	args?: Record<string, unknown>,
) => Promise<T>;

export function getTauriInvoke(): TauriInvoke | null {
	const tauriInternals = (
		globalThis as {
			__TAURI_INTERNALS__?: {
				invoke?: TauriInvoke;
			};
		}
	).__TAURI_INTERNALS__;

	if (typeof tauriInternals?.invoke === "function") {
		return tauriInternals.invoke;
	}
	return null;
}
