import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "@web/services/pwa";

describe("PWA registration", () => {
	it("registers the offline worker only for secure production pages", async () => {
		const register = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register } });
		Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
		vi.stubEnv("PROD", true);

		registerServiceWorker();
		await Promise.resolve();

		expect(register).toHaveBeenCalledWith("/service-worker.js", { scope: "/" });
	});
});
