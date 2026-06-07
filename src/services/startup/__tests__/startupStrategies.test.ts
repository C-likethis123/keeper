import { runStartupStrategy } from "../startupStrategies";

const mockInitializeStorageStep = jest.fn();
const mockInitializeGitStep = jest.fn();
const mockCreateStartupTelemetry = jest.fn();
const mockCheckForUpdates = jest.fn();

jest.mock("../startupSteps", () => ({
	initializeStorageStep: (...args: unknown[]) =>
		mockInitializeStorageStep(...args),
	initializeGitStep: (...args: unknown[]) => mockInitializeGitStep(...args),
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

function createContext() {
	return {
		setHydrated: jest.fn(),
		setInitError: jest.fn(),
		setStatusMessage: jest.fn(),
	};
}

describe("runStartupStrategy", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockCreateStartupTelemetry.mockReturnValue(createTelemetry());
		mockInitializeStorageStep.mockResolvedValue(undefined);
		mockInitializeGitStep.mockResolvedValue(undefined);
		mockCheckForUpdates.mockResolvedValue(undefined);
	});

	it("waits for mobile git initialization before hydrating", async () => {
		const context = createContext();

		await runStartupStrategy(context);

		expect(mockInitializeStorageStep).toHaveBeenCalledTimes(1);
		expect(mockInitializeGitStep).toHaveBeenCalledWith(
			{
				backgroundMode: false,
				setInitError: context.setInitError,
				setStatusMessage: context.setStatusMessage,
			},
			expect.any(Object),
		);
		expect(mockInitializeGitStep.mock.invocationCallOrder[0]).toBeLessThan(
			context.setHydrated.mock.invocationCallOrder[0],
		);
	});

	it("records startup failure telemetry and rethrows errors", async () => {
		const telemetry = createTelemetry();
		mockCreateStartupTelemetry.mockReturnValue(telemetry);
		const error = new Error("Storage failed");
		mockInitializeStorageStep.mockRejectedValue(error);

		await expect(runStartupStrategy(createContext())).rejects.toThrow(
			"Storage failed",
		);

		expect(telemetry.trace).toHaveBeenCalledWith(
			"startup_run_failed",
			expect.objectContaining({
				errorMessage: "Storage failed",
			}),
		);
	});
});
