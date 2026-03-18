import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	initializeGitStep,
	initializeStorageStep,
	initializeUnsupportedRuntimeStep,
} from "../startupSteps";

const {
	rebuildFromDisk,
	storageInitialize,
	gitInitialize,
	bumpContentVersion,
} = vi.hoisted(() => ({
	rebuildFromDisk: vi.fn(),
	storageInitialize: vi.fn(),
	gitInitialize: vi.fn(),
	bumpContentVersion: vi.fn(),
}));

vi.mock("@/services/notes/notesIndex", () => ({
	NotesIndexService: {
		rebuildFromDisk,
	},
}));

vi.mock("@/services/storage/storageInitializationService", () => ({
	StorageInitializationService: {
		instance: {
			initialize: storageInitialize,
		},
	},
}));

vi.mock("@/services/git/gitInitializationService", () => ({
	GitInitializationService: {
		instance: {
			initialize: gitInitialize,
		},
	},
}));

vi.mock("@/stores/storageStore", () => ({
	useStorageStore: {
		getState: () => ({
			bumpContentVersion,
		}),
	},
}));

function createTelemetry() {
	return {
		stepStarted: vi.fn(() => 101),
		stepCompleted: vi.fn(),
		stepFailed: vi.fn(),
		trace: vi.fn(),
	};
}

describe("startupSteps", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		rebuildFromDisk.mockResolvedValue({ noteCount: 3 });
	});

	it("rebuilds the notes index after storage initialization requests it", async () => {
		storageInitialize.mockResolvedValue({
			success: true,
			needsRebuild: true,
			readOnlyReason: undefined,
		});
		const telemetry = createTelemetry();
		const showToast = vi.fn();

		await initializeStorageStep(showToast, telemetry as never);

		expect(storageInitialize).toHaveBeenCalledTimes(1);
		expect(rebuildFromDisk).toHaveBeenCalledTimes(1);
		expect(bumpContentVersion).toHaveBeenCalledTimes(1);
		expect(showToast).not.toHaveBeenCalled();
	});

	it("shows a read-only toast when storage initialization fails with a reason", async () => {
		storageInitialize.mockResolvedValue({
			success: false,
			needsRebuild: false,
			readOnlyReason: "Missing permissions",
		});
		const telemetry = createTelemetry();
		const showToast = vi.fn();

		await initializeStorageStep(showToast, telemetry as never);

		expect(rebuildFromDisk).not.toHaveBeenCalled();
		expect(showToast).toHaveBeenCalledWith(
			"Read-only mode: Missing permissions",
			6000,
		);
		expect(telemetry.trace).toHaveBeenCalledWith("storage.read_only_mode", {
			reason: "Missing permissions",
		});
	});

	it("rebuilds and bumps content version after a successful clone", async () => {
		gitInitialize.mockResolvedValue({
			success: true,
			supported: true,
			wasCloned: true,
			metrics: { didDbSync: false },
		});
		const telemetry = createTelemetry();

		await initializeGitStep(
			{
				backgroundMode: false,
				showToast: vi.fn(),
				setInitError: vi.fn(),
			},
			telemetry as never,
		);

		expect(rebuildFromDisk).toHaveBeenCalledTimes(1);
		expect(bumpContentVersion).toHaveBeenCalledTimes(1);
	});

	it("surfaces git failures through setInitError in foreground mode", async () => {
		gitInitialize.mockResolvedValue({
			success: false,
			supported: true,
			error: "Sync exploded",
			metrics: { didDbSync: false },
		});
		const showToast = vi.fn();
		const setInitError = vi.fn();

		await initializeGitStep(
			{
				backgroundMode: false,
				showToast,
				setInitError,
			},
			createTelemetry() as never,
		);

		expect(showToast).not.toHaveBeenCalled();
		expect(setInitError).toHaveBeenCalledWith("Sync exploded");
	});

	it("reports unsupported runtimes through a toast and telemetry", async () => {
		const telemetry = createTelemetry();
		const showToast = vi.fn();

		await initializeUnsupportedRuntimeStep(
			{
				runtime: "unsupported",
				supported: false,
				reason: "Desktop-only feature",
			},
			showToast,
			telemetry as never,
		);

		expect(showToast).toHaveBeenCalledWith("Desktop-only feature", 6000);
		expect(telemetry.trace).toHaveBeenCalledWith("runtime.unsupported_reason", {
			reason: "Desktop-only feature",
		});
	});
});
