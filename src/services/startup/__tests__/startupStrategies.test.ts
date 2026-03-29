import type { GitRuntimeSupport } from "@/services/git/runtime";
import { runStartupStrategy } from "../startupStrategies";

const mockInitializeStorageStep = jest.fn();
const mockInitializeGitStep = jest.fn();
const mockInitializeUnsupportedRuntimeStep = jest.fn();
const mockCreateStartupTelemetry = jest.fn();
const mockCheckForUpdates = jest.fn();

jest.mock("../startupSteps", () => ({
	initializeStorageStep: (...args: unknown[]) =>
		mockInitializeStorageStep(...args),
	initializeGitStep: (...args: unknown[]) => mockInitializeGitStep(...args),
	initializeUnsupportedRuntimeStep: (...args: unknown[]) =>
		mockInitializeUnsupportedRuntimeStep(...args),
}));

jest.mock("../startupTelemetry", () => ({
	createStartupTelemetry: (...args: unknown[]) =>
		mockCreateStartupTelemetry(...args),
}));

jest.mock("@/utils/checkForUpdates", () => ({
	checkForUpdates: (...args: unknown[]) => mockCheckForUpdates(...args),
}));

function createTelemetry() {
	return {
		trace: jest.fn(),
		stepStarted: jest.fn(() => 100),
		stepCompleted: jest.fn(),
		stepFailed: jest.fn(),
	};
}

function createContext(runtimeSupport: GitRuntimeSupport) {
	return {
		runtimeSupport,
		showToast: jest.fn(),
		setHydrated: jest.fn(),
		setInitError: jest.fn(),
	};
}

describe("runStartupStrategy", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockCreateStartupTelemetry.mockReturnValue(createTelemetry());
		mockInitializeStorageStep.mockResolvedValue(undefined);
		mockInitializeGitStep.mockResolvedValue(undefined);
		mockInitializeUnsupportedRuntimeStep.mockResolvedValue(undefined);
		mockCheckForUpdates.mockResolvedValue(undefined);
	});

	it("hydrates desktop immediately after storage and starts git init in the background", async () => {
		const context = createContext({
			runtime: "desktop-tauri",
			supported: true,
		});
		let resolveGit: (() => void) | undefined;
		mockInitializeGitStep.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveGit = resolve;
				}),
		);

		await runStartupStrategy(context);

		expect(mockInitializeStorageStep).toHaveBeenCalledTimes(1);
		expect(context.setHydrated).toHaveBeenCalledTimes(1);
		expect(mockInitializeGitStep).toHaveBeenCalledWith(
			{
				backgroundMode: true,
				showToast: context.showToast,
				setInitError: context.setInitError,
			},
			expect.any(Object),
		);
		expect(context.setHydrated.mock.invocationCallOrder[0]).toBeLessThan(
			mockInitializeGitStep.mock.invocationCallOrder[0],
		);

		resolveGit?.();
	});

	it("waits for mobile git initialization before hydrating", async () => {
		const context = createContext({
			runtime: "mobile-native",
			supported: true,
		});

		await runStartupStrategy(context);

		expect(mockInitializeStorageStep).toHaveBeenCalledTimes(1);
		expect(mockInitializeGitStep).toHaveBeenCalledWith(
			{
				backgroundMode: false,
				showToast: context.showToast,
				setInitError: context.setInitError,
			},
			expect.any(Object),
		);
		expect(mockInitializeGitStep.mock.invocationCallOrder[0]).toBeLessThan(
			context.setHydrated.mock.invocationCallOrder[0],
		);
	});

	it("runs the unsupported-runtime path and still hydrates", async () => {
		const context = createContext({
			runtime: "unsupported",
			supported: false,
			reason: "No git bridge",
		});

		await runStartupStrategy(context);

		expect(mockInitializeUnsupportedRuntimeStep).toHaveBeenCalledWith(
			context.runtimeSupport,
			context.showToast,
			expect.any(Object),
		);
		expect(context.setHydrated).toHaveBeenCalledTimes(1);
		expect(mockInitializeGitStep).not.toHaveBeenCalled();
	});

	it("records startup failure telemetry and rethrows errors", async () => {
		const telemetry = createTelemetry();
		mockCreateStartupTelemetry.mockReturnValue(telemetry);
		const error = new Error("Storage failed");
		mockInitializeStorageStep.mockRejectedValue(error);

		await expect(
			runStartupStrategy(
				createContext({
					runtime: "mobile-native",
					supported: true,
				}),
			),
		).rejects.toThrow("Storage failed");

		expect(telemetry.trace).toHaveBeenCalledWith(
			"startup_run_failed",
			expect.objectContaining({
				errorMessage: "Storage failed",
			}),
		);
	});
});
