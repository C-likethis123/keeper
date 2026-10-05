import { vi } from "vitest";
vi.mock("@/services/startup/startupStrategies", () => ({
	runStartupStrategy: vi.fn(),
}));

vi.mock("@/services/startup/startupTelemetry", () => ({
	traceStartupBootstrapEvent: vi.fn(),
}));

vi.mock("@/services/sync/syncPullService", () => ({
	startSyncPullService: vi.fn(),
	stopSyncPullService: vi.fn(),
}));

vi.mock("@/services/sync/syncPushService", () => ({
	startSyncPushService: vi.fn(),
}));

import { runStartupStrategy } from "@/services/startup/startupStrategies";
import { startSyncPullService } from "@/services/sync/syncPullService";
import { startSyncPushService } from "@/services/sync/syncPushService";
import { renderHook, waitFor } from "@testing-library/react";
import { useAppStartup } from "../useAppStartup";

describe("useAppStartup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("reports ready after the startup strategy hydrates successfully", async () => {
		vi.mocked(runStartupStrategy).mockImplementation(
			async ({
				setHydrated,
			}: {
				setHydrated: () => void;
			}) => {
				setHydrated();
			},
		);

		const { result } = renderHook(() => useAppStartup());

		await waitFor(() => {
			expect(result.current.status).toBe("ready");
		});
		expect(result.current.isHydrated).toBe(true);
		expect(result.current.initError).toBeNull();
	});

	it("starts sync only after storage startup finishes", async () => {
		let finishStartup: (() => void) | undefined;
		vi.mocked(runStartupStrategy).mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					finishStartup = resolve;
				}),
		);

		renderHook(() => useAppStartup());

		expect(startSyncPushService).not.toHaveBeenCalled();
		expect(startSyncPullService).not.toHaveBeenCalled();
		finishStartup?.();

		await waitFor(() => {
			expect(startSyncPushService).toHaveBeenCalledTimes(1);
			expect(startSyncPullService).toHaveBeenCalledTimes(1);
		});
	});

	it("moves to error state when startup surfaces an init error", async () => {
		vi.mocked(runStartupStrategy).mockImplementation(
			async ({
				setInitError,
				setHydrated,
			}: {
				setInitError: (error: string) => void;
				setHydrated: () => void;
			}) => {
				setInitError("Sync exploded");
				setHydrated();
			},
		);

		const { result } = renderHook(() => useAppStartup());

		await waitFor(() => {
			expect(result.current.status).toBe("error");
		});
		expect(result.current.isHydrated).toBe(true);
		expect(result.current.initError).toBe("Sync exploded");
	});

	it("catches thrown startup failures and exposes a fallback error", async () => {
		vi.mocked(runStartupStrategy).mockRejectedValue(
			new Error("Unexpected startup failure"),
		);

		const { result } = renderHook(() => useAppStartup());

		await waitFor(() => {
			expect(result.current.status).toBe("error");
		});
		expect(result.current.isHydrated).toBe(true);
		expect(result.current.initError).toBe("Unexpected startup failure");
	});
});
