import { type RefObject, useEffect, useRef, useState } from "react";

export function useMobileViewport() {
	const [viewport, setViewport] = useState({
		height: 0,
		top: 0,
		mobile: false,
		limited: false,
	});
	useEffect(() => {
		const visual = window.visualViewport;
		const media = window.matchMedia?.(
			"(max-width: 48rem), (pointer: coarse)",
		);
		let closedHeight = window.innerHeight;
		let width = window.innerWidth;
		const update = () => {
			const height = visual?.height ?? window.innerHeight;
			if (width !== window.innerWidth) {
				width = window.innerWidth;
				closedHeight = document.documentElement.clientHeight;
			}
			const focused =
				(document.activeElement?.matches(
					"input, textarea, [contenteditable='true']",
				) ??
					false) &&
				!!document.activeElement?.closest(
					".editor-page, [data-testid='home-quick-composer-card'], .keeper-editor-scroller",
				);
			setViewport((current) => {
				const limited =
					(focused || current.limited) &&
					height <
						Math.max(closedHeight, document.documentElement.clientHeight) - 1;
				if (!focused && !limited) closedHeight = height;
				const next = {
					height,
					top: visual?.offsetTop ?? 0,
					mobile: (media?.matches ?? false) && (visual?.scale ?? 1) === 1,
					limited,
				};
				return current.height === next.height &&
					current.top === next.top &&
					current.mobile === next.mobile &&
					current.limited === next.limited
					? current
					: next;
			});
		};
		update();
		visual?.addEventListener("resize", update);
		visual?.addEventListener("scroll", update);
		window.addEventListener("resize", update);
		media?.addEventListener("change", update);
		document.addEventListener("focusin", update);
		document.addEventListener("focusout", update);
		return () => {
			visual?.removeEventListener("resize", update);
			visual?.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
			media?.removeEventListener("change", update);
			document.removeEventListener("focusin", update);
			document.removeEventListener("focusout", update);
		};
	}, []);
	return viewport;
}

export function useMobileEditorViewport(ref: RefObject<HTMLDivElement | null>) {
	const viewport = useMobileViewport();
	const viewportRef = useRef(viewport);
	viewportRef.current = viewport;
	useEffect(() => {
		const scroller = ref.current;
		if (!scroller) return;
		const page = scroller.closest<HTMLElement>(
			".editor-page, [data-testid='home-quick-composer-card']",
		);
		if (page) {
			if (!viewport.limited && page.dataset.keyboardLimited !== "true") {
				page.style.setProperty(
					"--editor-page-top",
					`${Math.max(0, page.getBoundingClientRect().top)}px`,
				);
			}
			page.style.setProperty(
				"--editor-viewport-height",
				`${viewport.height}px`,
			);
			page.style.setProperty("--editor-viewport-top", `${viewport.top}px`);
			page.dataset.mobileViewport = String(viewport.mobile);
			page.dataset.keyboardLimited = String(
				viewport.mobile && viewport.limited,
			);
		}
		if (viewport.mobile && !page) {
			const top = Math.max(scroller.getBoundingClientRect().top, viewport.top);
			scroller.style.maxHeight = `${Math.max(0, viewport.top + viewport.height - top)}px`;
		} else scroller.style.removeProperty("max-height");
	}, [ref, viewport]);
	useEffect(() => {
		const page = ref.current?.closest<HTMLElement>(
			".editor-page, [data-testid='home-quick-composer-card']",
		);
		return () => {
			if (page) {
				page.style.removeProperty("--editor-viewport-height");
				page.style.removeProperty("--editor-viewport-top");
				page.style.removeProperty("--editor-page-top");
				delete page.dataset.mobileViewport;
				delete page.dataset.keyboardLimited;
			}
		};
	}, [ref]);

	useEffect(() => {
		const scroller = ref.current;
		if (!scroller || !viewport.mobile) return;
		let frame = 0;
		let reading = false;
		let readingPosition: number | null = null;
		let anchor: Node | null = null;
		let focus: Node | null = null;
		let anchorOffset = -1;
		let focusOffset = -1;
		const reveal = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const selection = window.getSelection();
				if (
					reading ||
					!selection?.focusNode ||
					!scroller.contains(selection.focusNode) ||
					!scroller.contains(document.activeElement)
				)
					return;
				const range = document.createRange();
				range.setStart(selection.focusNode, selection.focusOffset);
				range.collapse(true);
				let rect = range.getBoundingClientRect();
				if (!rect.height) {
					const element =
						selection.focusNode.nodeType === Node.ELEMENT_NODE
							? (selection.focusNode as Element)
							: selection.focusNode.parentElement;
					rect = element?.getBoundingClientRect() ?? rect;
				}
				const bounds = scroller.getBoundingClientRect();
				const toolbar = scroller
					.querySelector(".keeper-toolbar-sticky")
					?.getBoundingClientRect();
				const visible = viewportRef.current;
				const top =
					Math.max(bounds.top, visible.top, toolbar?.bottom ?? bounds.top) + 12;
				const bottom =
					Math.min(bounds.bottom, visible.top + visible.height) - 12;
				const delta =
					rect.bottom > bottom
						? rect.bottom - bottom
						: rect.top < top
							? rect.top - top
							: 0;
				if (delta && rect.height && bottom > top) scroller.scrollTop += delta;
			});
		};
		const selectionChanged = () => {
			const selection = window.getSelection();
			if (
				!selection ||
				(anchor === selection.anchorNode &&
					focus === selection.focusNode &&
					anchorOffset === selection.anchorOffset &&
					focusOffset === selection.focusOffset)
			)
				return;
			anchor = selection.anchorNode;
			focus = selection.focusNode;
			anchorOffset = selection.anchorOffset;
			focusOffset = selection.focusOffset;
			reading = false;
			readingPosition = null;
			reveal();
		};
		const edited = () => {
			reading = false;
			readingPosition = null;
			reveal();
		};
		const read = () => {
			readingPosition = null;
			reading = true;
			cancelAnimationFrame(frame);
			const selection = window.getSelection();
			anchor = selection?.anchorNode ?? null;
			focus = selection?.focusNode ?? null;
			anchorOffset = selection?.anchorOffset ?? -1;
			focusOffset = selection?.focusOffset ?? -1;
		};
		const resized = () => {
			if (reading && readingPosition !== null) {
				// Browsers can scroll focused contenteditables themselves during layout resize.
				scroller.scrollTop = readingPosition;
			} else reveal();
		};
		const viewportResized = () => {
			readingPosition = reading ? scroller.scrollTop : null;
			resized();
		};
		const preserveReadingPosition = () => {
			if (
				reading &&
				readingPosition !== null &&
				scroller.scrollTop !== readingPosition
			) {
				scroller.scrollTop = readingPosition;
			}
		};
		const pointerDown = (event: PointerEvent) => {
			readingPosition = null;
			if (event.target === scroller) read();
		};
		const toolbarClicked = (event: MouseEvent) => {
			if (
				event.target instanceof Element &&
				event.target.closest(".keeper-toolbar-sticky")
			)
				edited();
		};
		const observer = new ResizeObserver(resized);
		observer.observe(scroller);
		scroller.addEventListener("input", edited);
		scroller.addEventListener("focusin", edited);
		scroller.addEventListener("keeper-editor-update", reveal);
		scroller.addEventListener("click", toolbarClicked);
		scroller.addEventListener("wheel", read, { passive: true });
		scroller.addEventListener("touchmove", read, { passive: true });
		scroller.addEventListener("pointerdown", pointerDown);
		scroller.addEventListener("scroll", preserveReadingPosition, {
			passive: true,
		});
		document.addEventListener("selectionchange", selectionChanged);
		window.visualViewport?.addEventListener("resize", viewportResized);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			scroller.removeEventListener("input", edited);
			scroller.removeEventListener("focusin", edited);
			scroller.removeEventListener("keeper-editor-update", reveal);
			scroller.removeEventListener("click", toolbarClicked);
			scroller.removeEventListener("wheel", read);
			scroller.removeEventListener("touchmove", read);
			scroller.removeEventListener("pointerdown", pointerDown);
			scroller.removeEventListener("scroll", preserveReadingPosition);
			document.removeEventListener("selectionchange", selectionChanged);
			window.visualViewport?.removeEventListener("resize", viewportResized);
		};
	}, [ref, viewport.mobile]);
	return viewport;
}
