import { useSettingsStore } from "@/stores/settings";

export function useSettings() {
  const folder = useSettingsStore((s) => s.folder);
  const isHydrated = useSettingsStore((s) => s.isHydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const setFolder = useSettingsStore((s) => s.setFolder);
  const clearFolder = useSettingsStore((s) => s.clearFolder);

  return {
    folder,
    hasFolder: !!folder,
    isHydrated,
    hydrate,
    setFolder,
    clearFolder,
  };
}
