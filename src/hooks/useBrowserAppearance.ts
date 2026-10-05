import { useSyncExternalStore } from "react";

function subscribeColorScheme(callback: () => void) {
	const query = window.matchMedia?.("(prefers-color-scheme: dark)");
	query?.addEventListener("change", callback);
	return () => query?.removeEventListener("change", callback);
}

export function useColorScheme(): "dark" | "light" {
	return useSyncExternalStore(
		subscribeColorScheme,
		() =>
			window.matchMedia?.("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light",
		() => "light",
	);
}

function subscribeResize(callback: () => void) {
	window.addEventListener("resize", callback);
	return () => window.removeEventListener("resize", callback);
}

export function useWindowWidth() {
	return useSyncExternalStore(
		subscribeResize,
		() => window.innerWidth,
		() => 1024,
	);
}
