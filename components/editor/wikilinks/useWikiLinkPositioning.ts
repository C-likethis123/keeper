import { autoPlacement, shift, useFloating } from "@floating-ui/react-native";
import { useEffect, useRef, useState } from "react";
import type { View } from "react-native";

interface UseWikiLinkPositioningReturn {
	refs: ReturnType<typeof useFloating>["refs"];
	scrollProps: ReturnType<typeof useFloating>["scrollProps"];
	containerRef: React.RefObject<View | null>;
	overlayStyle: {
		position: "absolute";
		left: number;
		top: number;
	};
}

export function useWikiLinkPositioning(
	showOverlay: boolean,
): UseWikiLinkPositioningReturn {
	const { refs, floatingStyles, scrollProps } = useFloating({
		placement: "bottom",
		middleware: [
			autoPlacement({
				padding: { bottom: 100 },
				allowedPlacements: ["bottom", "top"],
			}),
			shift(),
		],
		sameScrollView: false,
	});

	const containerRef = useRef<View>(null);
	const [containerWindowOffset, setContainerWindowOffset] = useState({
		x: 0,
		y: 0,
	});

	useEffect(() => {
		if (!showOverlay) return;
		const id = requestAnimationFrame(() => {
			containerRef.current?.measureInWindow((x: number, y: number) => {
				setContainerWindowOffset({ x, y });
			});
		});
		return () => cancelAnimationFrame(id);
	}, [showOverlay]);

	return {
		refs,
		scrollProps,
		containerRef,
		overlayStyle: {
			position: "absolute",
			left: floatingStyles.left - containerWindowOffset.x,
			top: floatingStyles.top - containerWindowOffset.y,
		},
	};
}
