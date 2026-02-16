import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type NotesMetaState = {
  pinned: Record<string, boolean>;
  togglePin: (filePath: string) => void;
  setPinned: (filePath: string, value: boolean) => void;
};

export const useNotesMetaStore = create<NotesMetaState>()(
  persist(
    (set) => ({
      pinned: {},
      togglePin: (filePath) =>
        set((state) => ({
          pinned: {
            ...state.pinned,
            [filePath]: !state.pinned[filePath],
          },
        })),
      setPinned: (filePath, value) =>
        set((state) => ({
          pinned: {
            ...state.pinned,
            [filePath]: value,
          },
        })),
    }),
    {
      name: "notes-meta",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
