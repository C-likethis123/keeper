import { NoteService } from "@/services/notes/noteService";
import { jest } from "@jest/globals";
import { renderHook, waitFor } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import { useShareIntent } from "expo-share-intent";
import { useShareHandler } from "../useShareHandler";

// Mock the dependencies
jest.mock("expo-share-intent");
jest.mock("expo-router");
jest.mock("@/services/notes/noteService");
jest.mock("nanoid", () => ({
	nanoid: () => "test-id",
}));

const mockShowToast = jest.fn();
jest.mock("@/services/toast", () => ({
	showToast: (...args: unknown[]) => mockShowToast(...args),
}));

describe("useShareHandler", () => {
	const mockResetShareIntent = jest.fn();
	const mockPush = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
		(useRouter as jest.Mock).mockReturnValue({ push: mockPush });
	});

	it("does nothing when no share intent is present", () => {
		(useShareIntent as jest.Mock).mockReturnValue({
			hasShareIntent: false,
			shareIntent: { webUrl: null, text: null, files: null, type: null },
			resetShareIntent: mockResetShareIntent,
			error: null,
		});

		renderHook(() => useShareHandler(true));

		expect(NoteService.saveNote).not.toHaveBeenCalled();
		expect(mockResetShareIntent).not.toHaveBeenCalled();
	});

	it("does nothing when not hydrated", () => {
		(useShareIntent as jest.Mock).mockReturnValue({
			hasShareIntent: true,
			shareIntent: {
				webUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
				text: null,
				files: null,
				type: "weburl",
			},
			resetShareIntent: mockResetShareIntent,
			error: null,
		});

		renderHook(() => useShareHandler(false));

		expect(NoteService.saveNote).not.toHaveBeenCalled();
	});

	it("creates a note and navigates when a YouTube URL is shared via webUrl (iOS)", async () => {
		const youtubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
		(useShareIntent as jest.Mock).mockReturnValue({
			hasShareIntent: true,
			shareIntent: { webUrl: youtubeUrl, text: null, files: null, type: "weburl" },
			resetShareIntent: mockResetShareIntent,
			error: null,
		});

		(NoteService.saveNote as jest.Mock).mockResolvedValue({ id: "test-id" });

		renderHook(() => useShareHandler(true));

		await waitFor(() => {
			expect(NoteService.saveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "test-id",
					title: "Resource: YouTube Video",
					noteType: "resource",
					attachedVideo: youtubeUrl,
				}),
				true,
			);
			expect(mockResetShareIntent).toHaveBeenCalled();
			expect(mockPush).toHaveBeenCalledWith("/editor?id=test-id");
			expect(mockShowToast).toHaveBeenCalledWith(
				expect.stringContaining("created"),
			);
		});
	});

	it("creates a note when a YouTube URL is shared via text (Android / copy-link)", async () => {
		const youtubeUrl = "https://youtu.be/dQw4w9WgXcQ";
		(useShareIntent as jest.Mock).mockReturnValue({
			hasShareIntent: true,
			shareIntent: {
				webUrl: null,
				text: `Check out this video ${youtubeUrl}`,
				files: null,
				type: "text",
			},
			resetShareIntent: mockResetShareIntent,
			error: null,
		});

		(NoteService.saveNote as jest.Mock).mockResolvedValue({ id: "test-id" });

		renderHook(() => useShareHandler(true));

		await waitFor(() => {
			expect(NoteService.saveNote).toHaveBeenCalledWith(
				expect.objectContaining({
					noteType: "resource",
					attachedVideo: youtubeUrl,
				}),
				true,
			);
			expect(mockPush).toHaveBeenCalledWith("/editor?id=test-id");
		});
	});

	it("resets intent and shows toast when an unsupported URL is shared", async () => {
		(useShareIntent as jest.Mock).mockReturnValue({
			hasShareIntent: true,
			shareIntent: { webUrl: "https://example.com", text: null, files: null, type: "weburl" },
			resetShareIntent: mockResetShareIntent,
			error: null,
		});

		renderHook(() => useShareHandler(true));

		await waitFor(() => {
			expect(NoteService.saveNote).not.toHaveBeenCalled();
			expect(mockResetShareIntent).toHaveBeenCalled();
			expect(mockShowToast).toHaveBeenCalledWith(
				expect.stringContaining("supported"),
			);
		});
	});

	it("handles errors from NoteService", async () => {
		(useShareIntent as jest.Mock).mockReturnValue({
			hasShareIntent: true,
			shareIntent: {
				webUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
				text: null,
				files: null,
				type: "weburl",
			},
			resetShareIntent: mockResetShareIntent,
			error: null,
		});

		(NoteService.saveNote as jest.Mock).mockRejectedValue(
			new Error("Save failed"),
		);

		renderHook(() => useShareHandler(true));

		await waitFor(() => {
			expect(mockResetShareIntent).toHaveBeenCalled();
			expect(mockShowToast).toHaveBeenCalledWith(
				expect.stringContaining("Failed"),
			);
		});
	});
});
