import { useSyncExternalStore } from "react";

const VITE_CACHE_PREFIX = "keeper-vite-shell-";

type PwaState = {
	supported: boolean;
	registered: boolean;
	updateAvailable: boolean;
	editorDirty: boolean;
	updateDeferred: boolean;
};

type PwaEnvironment = {
	production: boolean;
	navigator: Navigator;
	window: Window;
	caches?: CacheStorage;
};

let state: PwaState = {
	supported: false,
	registered: false,
	updateAvailable: false,
	editorDirty: false,
	updateDeferred: false,
};
let waitingWorker: ServiceWorker | null = null;
let reloadRequested = false;
let stopRegistrationListeners: (() => void) | null = null;
const listeners = new Set<() => void>();

function publish(change: Partial<PwaState>) {
	state = { ...state, ...change };
	for (const listener of listeners) listener();
}

export function getPwaState(): PwaState {
	return state;
}

function subscribePwaState(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function usePwaState(): PwaState {
	return useSyncExternalStore(subscribePwaState, getPwaState, getPwaState);
}

export function setPwaEditorDirty(editorDirty: boolean): void {
	publish({ editorDirty });
}

export function requestPwaUpdate(): boolean {
	if (!waitingWorker) return false;
	if (state.editorDirty) {
		publish({ updateDeferred: true });
		return false;
	}
	reloadRequested = true;
	publish({ updateDeferred: false });
	waitingWorker.postMessage({ type: "SKIP_WAITING" });
	return true;
}

function workerScriptPath(registration: ServiceWorkerRegistration): string | null {
	const scriptUrl =
		registration.active?.scriptURL ??
		registration.waiting?.scriptURL ??
		registration.installing?.scriptURL;
	if (!scriptUrl) return null;
	try {
		return new URL(scriptUrl).pathname;
	} catch {
		return null;
	}
}

async function cleanupDevelopmentPwa(environment: PwaEnvironment) {
	const serviceWorker = environment.navigator.serviceWorker;
	if (serviceWorker?.getRegistrations) {
		const registrations = await serviceWorker.getRegistrations();
		await Promise.all(
			registrations
				.filter(
					(registration) =>
						workerScriptPath(registration) === "/service-worker.js",
				)
				.map((registration) => registration.unregister()),
		);
	}
	if (environment.caches) {
		const names = await environment.caches.keys();
		await Promise.all(
			names
				.filter((name) => name.startsWith(VITE_CACHE_PREFIX))
				.map((name) => environment.caches?.delete(name)),
		);
	}
}

function watchRegistration(
	registration: ServiceWorkerRegistration,
	serviceWorker: ServiceWorkerContainer,
	windowObject: Window,
) {
	const showWaitingWorker = () => {
		if (!registration.waiting) return;
		waitingWorker = registration.waiting;
		publish({ updateAvailable: true });
	};
	const handleUpdateFound = () => {
		const installing = registration.installing;
		if (!installing) return;
		const handleStateChange = () => {
			if (installing.state === "installed" && serviceWorker.controller) {
				showWaitingWorker();
			}
			if (installing.state === "installed" || installing.state === "redundant") {
				installing.removeEventListener("statechange", handleStateChange);
			}
		};
		installing.addEventListener("statechange", handleStateChange);
	};
	const handleControllerChange = () => {
		if (!reloadRequested) return;
		reloadRequested = false;
		windowObject.location.reload();
	};
	registration.addEventListener("updatefound", handleUpdateFound);
	serviceWorker.addEventListener("controllerchange", handleControllerChange);
	showWaitingWorker();
	return () => {
		registration.removeEventListener("updatefound", handleUpdateFound);
		serviceWorker.removeEventListener("controllerchange", handleControllerChange);
	};
}

export async function registerServiceWorker(
	overrides: Partial<PwaEnvironment> = {},
): Promise<void> {
	const environment: PwaEnvironment = {
		production: import.meta.env.PROD,
		navigator,
		window,
		caches: globalThis.caches,
		...overrides,
	};
	const serviceWorker = environment.navigator.serviceWorker;
	const supported = !!serviceWorker && environment.window.isSecureContext;
	publish({ supported });
	if (!environment.production) {
		await cleanupDevelopmentPwa(environment);
		return;
	}
	if (!supported) return;

	stopRegistrationListeners?.();
	const serviceWorkerUrl = new URL(
		"service-worker.js",
		new URL(import.meta.env.BASE_URL, environment.window.location.origin),
	).pathname;
	const registration = await serviceWorker.register(serviceWorkerUrl, {
		scope: import.meta.env.BASE_URL,
	});
	publish({ registered: true });
	stopRegistrationListeners = watchRegistration(
		registration,
		serviceWorker,
		environment.window,
	);
}

export function resetPwaStateForTests(): void {
	stopRegistrationListeners?.();
	stopRegistrationListeners = null;
	waitingWorker = null;
	reloadRequested = false;
	state = {
		supported: false,
		registered: false,
		updateAvailable: false,
		editorDirty: false,
		updateDeferred: false,
	};
	listeners.clear();
}
