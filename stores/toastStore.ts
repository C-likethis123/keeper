// stores/toastStore.ts
import { create } from "zustand";

interface ToastState {
	message: string | null;
	showToast: (msg: string, duration?: number) => void;
}

export const useToastStore = create<ToastState>((set) => ({
	message: null,
	showToast: (msg, duration = 3000) => {
		set({ message: msg });
		setTimeout(() => set({ message: null }), duration);
	},
}));
