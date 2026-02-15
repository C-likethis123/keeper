import { create } from "zustand";
import { loadFolder, saveFolder, clearFolder } from "@/services/settings/storage";

type SettingsState = {
  folder: string | null;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  setFolder: (path: string) => Promise<void>;
  clearFolder: () => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  folder: null,
  isHydrated: false,

  hydrate: async () => {
    const folder = await loadFolder();
    set({ folder, isHydrated: true });
  },

  setFolder: async (path) => {
    await saveFolder(path);
    set({ folder: path });
  },

  clearFolder: async () => {
    await clearFolder();
    set({ folder: null });
  },
}));
