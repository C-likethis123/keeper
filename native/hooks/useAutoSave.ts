import { useEffect, useRef, useState } from "react";
import { useNoteStore } from "@/stores/notes/noteService";

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

  useEffect(() => {
    // mark dirty immediately
    setStatus("idle");

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      setStatus("saving");

      await saveNote({
        filePath,
        title: title.trim() || "Untitled",
        content,
        isPinned,
      });

      setStatus("saved");
    }, 2000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [filePath, title, content, isPinned, saveNote]);

  return { status };
}
