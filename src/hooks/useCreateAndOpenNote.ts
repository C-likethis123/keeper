import { NoteService } from "@/services/notes/noteService";
import type { NoteType } from "@/services/notes/types";
import { useTabStore } from "@/stores/tabStore";
import { useToastStore } from "@/stores/toastStore";
import { router } from "expo-router";
import { nanoid } from "nanoid";
import { useCallback } from "react";

export function useCreateAndOpenNote() {
	const showToast = useToastStore((state) => state.showToast);

	return useCallback(
		async (options?: { title?: string; noteType?: NoteType }) => {
			const newId = nanoid();

			try {
				const { openTab } = useTabStore.getState();
				openTab(newId, options?.title ?? "");
				router.push({
					pathname: "/editor",
					params: {
						id: newId,
						isNew: "true",
						...(options?.title ? { title: options.title } : {}),
						...(options?.noteType ? { noteType: options.noteType } : {}),
					},
				});
			} catch (error) {
				console.warn("Failed to create note:", error);
				showToast("Failed to create note");
			}
		},
		[showToast],
	);
}
