import { renderHook, waitFor } from "@testing-library/react-native";
import { useShareHandler } from "../useShareHandler";
import { useShareIntent } from "expo-share-intent";
import { useRouter } from "expo-router";
import { NoteService } from "@/services/notes/noteService";
import { useToastStore } from "@/stores/toastStore";
import { jest } from "@jest/globals";

// Mock the dependencies
jest.mock("expo-share-intent");
jest.mock("expo-router");
jest.mock("@/services/notes/noteService");
jest.mock("@/stores/toastStore");
jest.mock("nanoid", () => ({
  nanoid: () => "test-id",
}));

describe("useShareHandler", () => {
  const mockResetShareIntent = jest.fn();
  const mockPush = jest.fn();
  const mockShowToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (useToastStore as unknown as jest.Mock).mockReturnValue(mockShowToast);
  });

  it("does nothing when no share intent is present", () => {
    (useShareIntent as jest.Mock).mockReturnValue({
      hasShareIntent: false,
      shareIntent: {},
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
      shareIntent: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      resetShareIntent: mockResetShareIntent,
      error: null,
    });

    renderHook(() => useShareHandler(false));

    expect(NoteService.saveNote).not.toHaveBeenCalled();
  });

  it("creates a note and navigates when a YouTube URL is shared", async () => {
    const youtubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    (useShareIntent as jest.Mock).mockReturnValue({
      hasShareIntent: true,
      shareIntent: { value: youtubeUrl },
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
        true
      );
      expect(mockResetShareIntent).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/editor?id=test-id");
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("created"));
    });
  });

  it("resets intent and shows toast when an unsupported URL is shared", async () => {
    (useShareIntent as jest.Mock).mockReturnValue({
      hasShareIntent: true,
      shareIntent: { value: "https://example.com" },
      resetShareIntent: mockResetShareIntent,
      error: null,
    });

    renderHook(() => useShareHandler(true));

    await waitFor(() => {
      expect(NoteService.saveNote).not.toHaveBeenCalled();
      expect(mockResetShareIntent).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("supported"));
    });
  });

  it("handles errors from NoteService", async () => {
    (useShareIntent as jest.Mock).mockReturnValue({
      hasShareIntent: true,
      shareIntent: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      resetShareIntent: mockResetShareIntent,
      error: null,
    });

    (NoteService.saveNote as jest.Mock).mockRejectedValue(new Error("Save failed"));

    renderHook(() => useShareHandler(true));

    await waitFor(() => {
      expect(mockResetShareIntent).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining("Failed"));
    });
  });
});
