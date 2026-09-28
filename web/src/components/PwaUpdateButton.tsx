import { requestPwaUpdate, usePwaState } from "@web/services/pwa";

export function PwaUpdateButton() {
	const pwa = usePwaState();
	if (!pwa.updateAvailable) return null;
	const blocked = pwa.editorDirty;
	return (
		<button
			type="button"
			className="text-button"
			disabled={blocked}
			onClick={requestPwaUpdate}
		>
			{blocked || pwa.updateDeferred
				? "Update pending—save note first"
				: "Update Keeper"}
		</button>
	);
}
