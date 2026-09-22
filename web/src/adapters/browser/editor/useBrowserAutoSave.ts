import { useEffect, useRef } from "react";

const AUTO_SAVE_DEBOUNCE_MS = 2_000;
const AUTO_SAVE_INTERVAL_MS = 60_000;

/** DOM port of useAutoSave timing. Persistence stays in browser editor session. */
export function useBrowserAutoSave({
	dirty,
	save,
	onError,
}: { dirty: boolean; save: () => Promise<void>; onError: () => void }) {
	const dirtyRef = useRef(dirty);
	const saveRef = useRef(save);
	const onErrorRef = useRef(onError);
	dirtyRef.current = dirty;
	saveRef.current = save;
	onErrorRef.current = onError;
	useEffect(() => {
		const interval = window.setInterval(() => {
			if (dirtyRef.current) void saveRef.current().catch(onErrorRef.current);
		}, AUTO_SAVE_INTERVAL_MS);
		return () => window.clearInterval(interval);
	}, []);
	useEffect(() => {
		if (!dirty) return;
		const timer = window.setTimeout(() => {
			void save().catch(onError);
		}, AUTO_SAVE_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [dirty, save, onError]);
}
