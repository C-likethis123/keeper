export function registerServiceWorker(): void {
	if (!import.meta.env.PROD || !("serviceWorker" in navigator) || !window.isSecureContext) return;
	void navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
}
