import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

type NotesMetaState = {
  pinned: Record<string, boolean>;
  togglePin: (filePath: string) => void;
};

export const useNotesMetaStore = create<NotesMetaState>()(
  persist(
    (set, get) => ({
      pinned: {},
      togglePin: (filePath) =>
        set((state) => ({
          pinned: {
            ...state.pinned,
            [filePath]: !state.pinned[filePath],
          },
        })),
    }),
    {
      name: "notes-meta",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
