import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
  isHydrated: boolean;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      isHydrated: false,
      setThemeMode: (mode: ThemeMode) => {
        set({ themeMode: mode });
      },
      hydrate: async () => {
        // Hydration is handled by persist middleware
        set({ isHydrated: true });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

