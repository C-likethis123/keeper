import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import { View } from "react-native";
import type { DrawingCanvasProps } from "./DrawingCanvasSkia";

export default function DrawingCanvas(props: DrawingCanvasProps) {
	return (
		<WithSkiaWeb
			getComponent={() => import("./DrawingCanvasSkia")}
			componentProps={props}
			fallback={
				<View
					style={{ flex: 1, backgroundColor: props.document.background.color }}
				/>
			}
		/>
	);
}

export type { DrawingCanvasProps } from "./DrawingCanvasSkia";
