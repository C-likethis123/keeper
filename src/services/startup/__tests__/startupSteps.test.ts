import { vi } from "vitest";
const { mockBumpContentVersion } = vi.hoisted(() => ({
	mockBumpContentVersion: vi.fn(),
}));
import { NotesIndexService } from "@/services/notes/notesIndex";
import { StorageInitializationService } from "@/services/storage/storageInitializationService";
import { useStorageStore } from "@/stores/storageStore";
import { initializeStorageStep } from "../startupSteps";

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
		process.env.EXPO_PUBLIC_SYNC_SERVER_URL = undefined;
		vi.restoreAllMocks();
		vi.clearAllMocks();
		vi.spyOn(NotesIndexService, "rebuildFromDisk").mockResolvedValue({
			noteCount: 3,
		});
		useStorageStore.setState({
			bumpContentVersion: mockBumpContentVersion,
		});
	});

	it("rebuilds the notes index after storage initialization requests it", async () => {
		vi.spyOn(
			StorageInitializationService.instance,
			"initialize",
		).mockResolvedValue({
			needsRebuild: true,
		});
		const telemetry = createTelemetry();

		await initializeStorageStep(telemetry as never);

		expect(
			StorageInitializationService.instance.initialize,
		).toHaveBeenCalledTimes(1);
		expect(NotesIndexService.rebuildFromDisk).toHaveBeenCalledTimes(1);
		expect(mockBumpContentVersion).toHaveBeenCalledTimes(1);
	});

	it("surfaces storage initialization failures instead of entering read-only mode", async () => {
		const error = new Error("Missing permissions");
		vi.spyOn(
			StorageInitializationService.instance,
			"initialize",
		).mockRejectedValue(error);
		const telemetry = createTelemetry();

		await expect(initializeStorageStep(telemetry as never)).rejects.toThrow(
			"Missing permissions",
		);
		expect(NotesIndexService.rebuildFromDisk).not.toHaveBeenCalled();
		expect(telemetry.stepFailed).toHaveBeenCalledWith(
			"storage.initialize",
			101,
			error,
		);
	});
});
