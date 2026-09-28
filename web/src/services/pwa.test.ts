import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getPwaState,
	registerServiceWorker,
	requestPwaUpdate,
	resetPwaStateForTests,
	setPwaEditorDirty,
} from "@web/services/pwa";

type WorkerHarness = {
	container: ServiceWorkerContainer;
	register: ReturnType<typeof vi.fn>;
	registration: ServiceWorkerRegistration;
	reload: ReturnType<typeof vi.fn>;
	waiting: ServiceWorker;
	windowObject: Window;
};

function workerHarness(options: { waiting?: boolean } = {}): WorkerHarness {
	const waiting = {
		postMessage: vi.fn(),
		scriptURL: "https://keeper.test/service-worker.js",
	} as unknown as ServiceWorker;
	const registrationTarget = new EventTarget();
	const registration = Object.assign(registrationTarget, {
		active: waiting,
		installing: null,
		waiting: options.waiting ? waiting : null,
		unregister: vi.fn().mockResolvedValue(true),
	}) as unknown as ServiceWorkerRegistration;
	const register = vi.fn().mockResolvedValue(registration);
	const container = Object.assign(new EventTarget(), {
		controller: {},
		register,
		getRegistrations: vi.fn().mockResolvedValue([registration]),
	}) as unknown as ServiceWorkerContainer;
	const reload = vi.fn();
	const windowObject = {
		isSecureContext: true,
		location: { origin: "https://keeper.test", reload },
	} as unknown as Window;
	return { container, register, registration, reload, waiting, windowObject };
}

afterEach(() => {
	resetPwaStateForTests();
	vi.restoreAllMocks();
});

describe("PWA registration", () => {
	it("registers only in secure production browser", async () => {
		const harness = workerHarness();
		await registerServiceWorker({
			production: true,
			navigator: { serviceWorker: harness.container } as Navigator,
			window: harness.windowObject,
		});

		expect(harness.register).toHaveBeenCalledWith("/service-worker.js", {
			scope: "/",
		});
		expect(getPwaState()).toMatchObject({ supported: true, registered: true });
	});

	it("disables registration and cleans stale Vite state in development", async () => {
		const harness = workerHarness();
		const deleteCache = vi.fn().mockResolvedValue(true);
		await registerServiceWorker({
			production: false,
			navigator: { serviceWorker: harness.container } as Navigator,
			window: harness.windowObject,
			caches: {
				keys: vi
					.fn()
					.mockResolvedValue(["keeper-vite-shell-old", "keeper-shell-v4"]),
				delete: deleteCache,
			} as unknown as CacheStorage,
		});

		expect(harness.register).not.toHaveBeenCalled();
		expect(harness.registration.unregister).toHaveBeenCalledOnce();
		expect(deleteCache).toHaveBeenCalledWith("keeper-vite-shell-old");
		expect(deleteCache).not.toHaveBeenCalledWith("keeper-shell-v4");
	});

	it("does not register in insecure browser", async () => {
		const harness = workerHarness();
		Object.assign(harness.windowObject, { isSecureContext: false });
		await registerServiceWorker({
			production: true,
			navigator: { serviceWorker: harness.container } as Navigator,
			window: harness.windowObject,
		});
		expect(harness.register).not.toHaveBeenCalled();
	});

	it("exposes waiting update and applies it only for clean editor", async () => {
		const harness = workerHarness({ waiting: true });
		await registerServiceWorker({
			production: true,
			navigator: { serviceWorker: harness.container } as Navigator,
			window: harness.windowObject,
		});
		expect(getPwaState().updateAvailable).toBe(true);

		expect(requestPwaUpdate()).toBe(true);
		expect(harness.waiting.postMessage).toHaveBeenCalledWith({
			type: "SKIP_WAITING",
		});
		harness.container.dispatchEvent(new Event("controllerchange"));
		expect(harness.reload).toHaveBeenCalledOnce();
	});

	it("defers update while editor is dirty", async () => {
		const harness = workerHarness({ waiting: true });
		await registerServiceWorker({
			production: true,
			navigator: { serviceWorker: harness.container } as Navigator,
			window: harness.windowObject,
		});
		setPwaEditorDirty(true);

		expect(requestPwaUpdate()).toBe(false);
		expect(getPwaState().updateDeferred).toBe(true);
		expect(harness.waiting.postMessage).not.toHaveBeenCalled();
		harness.container.dispatchEvent(new Event("controllerchange"));
		expect(harness.reload).not.toHaveBeenCalled();
	});
});
