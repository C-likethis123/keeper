jest.mock("@/services/startup/startupStrategies", () => ({
	runStartupStrategy: jest.fn(),
}));

jest.mock("@/services/startup/startupTelemetry", () => ({
	traceStartupBootstrapEvent: jest.fn(),
}));

jest.mock("@/services/sync/syncPullService", () => ({
	startSyncPullService: jest.fn(),
	stopSyncPullService: jest.fn(),
}));

jest.mock("@/services/sync/syncPushService", () => ({
	startSyncPushService: jest.fn(),
}));

import { runStartupStrategy } from "@/services/startup/startupStrategies";
import { startSyncPullService } from "@/services/sync/syncPullService";
import { startSyncPushService } from "@/services/sync/syncPushService";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useAppStartup } from "../useAppStartup";

describe("useAppStartup", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("reports ready after the startup strategy hydrates successfully", async () => {
		(runStartupStrategy as jest.Mock).mockImplementation(
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
		(runStartupStrategy as jest.Mock).mockImplementation(
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
		(runStartupStrategy as jest.Mock).mockImplementation(
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
		(runStartupStrategy as jest.Mock).mockRejectedValue(
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
