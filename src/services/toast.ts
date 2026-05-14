import { useToastStore } from "@/stores/toastStore";

export function showToast(msg: string, duration?: number) {
	useToastStore.getState().showToast(msg, duration);
}
