import { NoteService } from "@/services/notes/noteService";
import { useToastStore } from "@/stores/toastStore";
import { router } from "expo-router";
import { nanoid } from "nanoid";
import { useCallback } from "react";

export function useCreateAndOpenNote() {
	const showToast = useToastStore((state) => state.showToast);

	return useCallback(async () => {
		const newNote = {
			id: nanoid(),
			title: "",
			content: "",
			isPinned: false,
			noteType: "note" as const,
		};

		try {
			await NoteService.saveNote(newNote, true);
			router.push({
				pathname: "/editor",
				params: { id: newNote.id },
			});
		} catch (error) {
			console.warn("Failed to create note:", error);
			showToast("Failed to create note");
		}
	}, [showToast]);
}
