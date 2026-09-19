/** Vite boundary for optional Tauri APIs. Browser code never imports Tauri directly. */
export type DesktopBridge = {
	invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
	convertFileSrc?(path: string): string;
};

export function getDesktopBridge(): DesktopBridge | null {
	const runtime = globalThis as typeof globalThis & {
		__TAURI_INTERNALS__?: DesktopBridge;
	};
	return typeof runtime.__TAURI_INTERNALS__?.invoke === "function"
		? runtime.__TAURI_INTERNALS__
		: null;
}
