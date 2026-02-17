import { useNotesMetaStore } from "@/stores/notes/metaStore";
import { useNoteStore } from "@/stores/notes/noteStore";
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
  const lastSavedRef = useRef<{
    title: string;
    content: string;
    isPinned: boolean;
  } | null>(null);
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
    lastSavedRef.current = {
      title: title.trim() || "Untitled",
      content,
      isPinned,
    };
    setStatus("saved");
  }, [filePath, title, content, isPinned, saveNote]);

  useEffect(() => {
    setStatus("idle");

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const runSave = async () => {
      const trimmedTitle = title.trim() || "Untitled";
      const last = lastSavedRef.current;
      const onlyPinChanged =
        last &&
        last.title === trimmedTitle &&
        last.content === content &&
        last.isPinned !== isPinned;
      if (onlyPinChanged && filePath) {
        useNotesMetaStore.getState().setPinned(filePath, isPinned);
        lastSavedRef.current = { title: trimmedTitle, content, isPinned };
        return;
      }
      setStatus("saving");
      await saveNote({ filePath, title: trimmedTitle, content, isPinned });
      lastSavedRef.current = { title: trimmedTitle, content, isPinned };
      setStatus("saved");
    };

    timerRef.current = setTimeout(runSave, 2000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [filePath, title, content, isPinned, saveNote]);

  return { status, saveNow };
}
