import { useEffect, useRef, type ReactNode } from "react";
import "./shared.css";

export function Dialog({
	open,
	onDismiss,
	onOpen,
	children,
	label,
}: {
	open: boolean;
	onDismiss: () => void;
	onOpen?: () => void;
	children: ReactNode;
	label: string;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const onOpenRef = useRef(onOpen);
	onOpenRef.current = onOpen;
	useEffect(() => {
		const dialog = ref.current;
		if (!dialog || !open) return;
		const previousFocus = document.activeElement;
		if (typeof dialog.showModal === "function") dialog.showModal();
		else dialog.setAttribute("open", "");
		onOpenRef.current?.();
		return () => {
			if (typeof dialog.close === "function") dialog.close();
			else dialog.removeAttribute("open");
			if (previousFocus instanceof HTMLElement) previousFocus.focus();
		};
	}, [open]);
	if (!open) return null;
	return (
		<dialog
			ref={ref}
			className="keeper-dialog"
			aria-label={label}
			onCancel={(event) => {
				event.preventDefault();
				onDismiss();
			}}
		>
			{children}
		</dialog>
	);
}
