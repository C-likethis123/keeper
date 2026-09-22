import type { EditorSaveStatus } from "@keeper/features/editor/editor-header-contract";

const label: Record<Exclude<EditorSaveStatus, "idle">, string> = {
	saving: "Saving…",
	saved: "Saved",
};

/** DOM renderer for the shared SaveIndicator state contract. */
export function BrowserSaveIndicator({ status }: { status: EditorSaveStatus }) {
	if (status === "idle") return null;
	return (
		<output
			className={`browser-save-status browser-save-status--${status}`}
			aria-live="polite"
		>
			<span aria-hidden="true">{status === "saving" ? "◌" : "✓"}</span>
			{label[status]}
		</output>
	);
}
