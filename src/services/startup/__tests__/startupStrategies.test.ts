import { vi } from "vitest";
const { mockInitializeStorageStep, mockCreateStartupTelemetry } = vi.hoisted(
	() => ({
		mockInitializeStorageStep: vi.fn(),
		mockCreateStartupTelemetry: vi.fn(),
	}),
);
import { runStartupStrategy } from "../startupStrategies";

vi.mock("../startupSteps", () => ({
	initializeStorageStep: (...args: unknown[]) =>
		mockInitializeStorageStep(...args),
}));

vi.mock("../startupTelemetry", () => ({
	createStartupTelemetry: (...args: unknown[]) =>
		mockCreateStartupTelemetry(...args),
}));

function createTelemetry() {
	return {
		trace: vi.fn(),
		stepStarted: vi.fn(() => 100),
		stepCompleted: vi.fn(),
		stepFailed: vi.fn(),
	};
}

function createContext() {
	return {
		setHydrated: vi.fn(),
		setInitError: vi.fn(),
		setStatusMessage: vi.fn(),
	};
}

describe("runStartupStrategy", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCreateStartupTelemetry.mockReturnValue(createTelemetry());
		mockInitializeStorageStep.mockResolvedValue(undefined);
	});

	it("waits for storage initialization before hydrating", async () => {
		const context = createContext();

		await runStartupStrategy(context);

		expect(mockInitializeStorageStep).toHaveBeenCalledTimes(1);
		expect(mockInitializeStorageStep.mock.invocationCallOrder[0]).toBeLessThan(
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
