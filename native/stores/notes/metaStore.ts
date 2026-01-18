import { create } from "zustand";

export const useNotesMetaStore = create<{
    pinned: Record<string, boolean>;
    togglePin: (filePath: string) => void;
  }>((set, get) => ({
    pinned: {},
    togglePin: (filePath) =>
      set((state) => ({
        pinned: {
          ...state.pinned,
          [filePath]: !state.pinned[filePath],
        },
      })),
  }));
  