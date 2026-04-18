import { useShareIntent } from "expo-share-intent";
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { NoteService } from "@/services/notes/noteService";
import { parseEmbeddedVideoUrl } from "@/components/editor/video/videoUtils";
import { nanoid } from "nanoid";
import { useToastStore } from "@/stores/toastStore";

export function useShareHandler(isHydrated: boolean) {
  const { hasShareIntent, shareIntent, resetShareIntent, error } = useShareIntent();
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);

  useEffect(() => {
    if (error) {
      console.error("[ShareHandler] Error:", error);
      showToast(`Share Error: ${error}`);
      resetShareIntent();
    }
  }, [error, showToast, resetShareIntent]);

  useEffect(() => {
    if (!isHydrated || !hasShareIntent || !shareIntent.value) {
      return;
    }

    const processShareIntent = async () => {
      const sharedValue = shareIntent.value;
      if (!sharedValue) return;

      console.log("[ShareHandler] Processing share intent:", sharedValue);

      // We only care about URLs for now, specifically YouTube URLs
      const videoSource = parseEmbeddedVideoUrl(sharedValue);
      
      if (videoSource) {
        try {
          const id = nanoid();
          const title = "Resource: YouTube Video";
          const content = `![video](${sharedValue})\n\nShared from YouTube.`;
          
          const newNote = await NoteService.saveNote({
            id,
            title,
            content,
            isPinned: false,
            noteType: "resource",
            status: null,
            attachedVideo: sharedValue,
          }, true);

          console.log("[ShareHandler] Created new note:", newNote.id);
          
          // Reset the intent so it doesn't trigger again
          resetShareIntent();
          
          // Navigate to the editor
          router.push(`/editor?id=${newNote.id}`);
          showToast("New resource note created from shared video");
        } catch (err) {
          console.error("[ShareHandler] Failed to create note:", err);
          showToast("Failed to create note from shared content");
          resetShareIntent();
        }
      } else {
        // If it's not a YouTube URL, maybe it's just a generic link or text
        // For now, let's just ignore or show a toast if we want to be strict
        console.log("[ShareHandler] Shared content is not a supported video URL");
        // We might want to create a generic note if it's a URL but not YouTube?
        // But the task is specifically "YouTube Sharing Integration".
        
        // If it looks like a URL but not YouTube, maybe just a normal note?
        // The task says "A shared YouTube video will automatically create a resource note with the link attached."
        
        // Let's stick to YouTube for now as per task.
        showToast("Only YouTube videos are currently supported for sharing");
        resetShareIntent();
      }
    };

    void processShareIntent();
  }, [isHydrated, hasShareIntent, shareIntent, resetShareIntent, router, showToast]);
}
