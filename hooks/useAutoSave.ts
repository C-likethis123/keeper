import { useNoteStore } from "@/stores/notes/noteService";
import { useCallback, useEffect, useRef, useState } from "react";

type AutoSaveInput = {
  filePath: string;
  title: string;
  content: string;
  isPinned: boolean;
};

export function useAutoSave({
  filePath,
  title,
  content,
  isPinned,
}: AutoSaveInput) {
  const { saveNote } = useNoteStore();

  const timerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setStatus("saving");
    await saveNote({
      filePath,
      title: title.trim() || "Untitled",
      content,
      isPinned,
    });
    setStatus("saved");
  }, [filePath, title, content, isPinned, saveNote]);

  useEffect(() => {
    setStatus("idle");

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(saveNow, 2000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [filePath, title, content, isPinned, saveNow]);

  return { status, saveNow };
}
