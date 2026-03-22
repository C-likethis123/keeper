import { GitInitializationService } from "@/services/git/gitInitializationService";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { StorageInitializationService } from "@/services/storage/storageInitializationService";
import { useStorageStore } from "@/stores/storageStore";
import {
	initializeGitStep,
	initializeStorageStep,
	initializeUnsupportedRuntimeStep,
} from "../startupSteps";

const mockBumpContentVersion = jest.fn();

function createTelemetry() {
	return {
		stepStarted: jest.fn(() => 101),
		stepCompleted: jest.fn(),
		stepFailed: jest.fn(),
		trace: jest.fn(),
	};
}

describe("startupSteps", () => {
	beforeEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
		jest
			.spyOn(NotesIndexService, "rebuildFromDisk")
			.mockResolvedValue({ noteCount: 3 });
		useStorageStore.setState({
			bumpContentVersion: mockBumpContentVersion,
		});
	});

	it("rebuilds the notes index after storage initialization requests it", async () => {
		jest
			.spyOn(StorageInitializationService.instance, "initialize")
			.mockResolvedValue({
				success: true,
				needsRebuild: true,
				readOnlyReason: undefined,
			});
		const telemetry = createTelemetry();
		const showToast = jest.fn();

		await initializeStorageStep(showToast, telemetry as never);

		expect(StorageInitializationService.instance.initialize).toHaveBeenCalledTimes(
			1,
		);
		expect(NotesIndexService.rebuildFromDisk).toHaveBeenCalledTimes(1);
		expect(mockBumpContentVersion).toHaveBeenCalledTimes(1);
		expect(showToast).not.toHaveBeenCalled();
	});

	it("shows a read-only toast when storage initialization fails with a reason", async () => {
		jest
			.spyOn(StorageInitializationService.instance, "initialize")
			.mockResolvedValue({
				success: false,
				needsRebuild: false,
				readOnlyReason: "Missing permissions",
			});
		const telemetry = createTelemetry();
		const showToast = jest.fn();

		await initializeStorageStep(showToast, telemetry as never);

		expect(NotesIndexService.rebuildFromDisk).not.toHaveBeenCalled();
		expect(showToast).toHaveBeenCalledWith(
			"Read-only mode: Missing permissions",
			6000,
		);
		expect(telemetry.trace).toHaveBeenCalledWith("storage.read_only_mode", {
			reason: "Missing permissions",
		});
	});

	it("rebuilds and bumps content version after a successful clone", async () => {
		jest.spyOn(GitInitializationService.instance, "initialize").mockResolvedValue({
			success: true,
			supported: true,
			wasCloned: true,
			metrics: { didDbSync: false },
		} as Awaited<ReturnType<typeof GitInitializationService.instance.initialize>>);
		const telemetry = createTelemetry();

		await initializeGitStep(
			{
				backgroundMode: false,
				showToast: jest.fn(),
				setInitError: jest.fn(),
			},
			telemetry as never,
		);

		expect(NotesIndexService.rebuildFromDisk).toHaveBeenCalledTimes(1);
		expect(mockBumpContentVersion).toHaveBeenCalledTimes(1);
	});

	it("surfaces git failures through setInitError in foreground mode", async () => {
		jest.spyOn(GitInitializationService.instance, "initialize").mockResolvedValue({
			success: false,
			supported: true,
			error: "Sync exploded",
			metrics: { didDbSync: false },
		} as Awaited<ReturnType<typeof GitInitializationService.instance.initialize>>);
		const showToast = jest.fn();
		const setInitError = jest.fn();

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
		const showToast = jest.fn();

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
