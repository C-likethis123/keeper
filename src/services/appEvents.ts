type AppEvent = "focusSearch" | "forceSave";
type Listener = () => void;

const listeners = new Map<AppEvent, Set<Listener>>();

export const appEvents = {
	on(event: AppEvent, listener: Listener): () => void {
		let set = listeners.get(event);
		if (!set) {
			set = new Set();
			listeners.set(event, set);
		}
		set.add(listener);
		return () => listeners.get(event)?.delete(listener);
	},
	emit(event: AppEvent) {
		for (const fn of listeners.get(event) ?? []) {
			fn();
		}
	},
};
