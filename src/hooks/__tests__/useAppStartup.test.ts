jest.mock("@/services/git/runtime", () => ({
	getGitRuntimeSupport: jest.fn(() => ({
		runtime: "desktop-tauri",
		supported: true,
	})),
}));

jest.mock("@/services/startup/startupStrategies", () => ({
	runStartupStrategy: jest.fn(),
}));

jest.mock("@/services/startup/startupTelemetry", () => ({
	traceStartupBootstrapEvent: jest.fn(),
}));

const mockShowToast = jest.fn();

jest.mock("@/stores/toastStore", () => ({
	useToastStore: (
		selector: (state: { showToast: typeof mockShowToast }) => unknown,
	) => selector({ showToast: mockShowToast }),
}));

import { getGitRuntimeSupport } from "@/services/git/runtime";
import { runStartupStrategy } from "@/services/startup/startupStrategies";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useAppStartup } from "../useAppStartup";

describe("useAppStartup", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(getGitRuntimeSupport as jest.Mock).mockReturnValue({
			runtime: "desktop-tauri",
			supported: true,
		});
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
		expect(result.current.runtime).toBe("desktop-tauri");
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
