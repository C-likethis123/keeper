import {
	releaseImageUri,
	resolveImageUri,
} from "@/services/notes/imageStorage";
import { Image, type ImageLoadEventData } from "expo-image";
import * as React from "react";

export default function ImageComponent({
	src,
	altText,
	}: {
		src: string;
		altText: string;
	}): React.ReactElement {
	const [resolvedSrc, setResolvedSrc] = React.useState(src);
	const [aspectRatio, setAspectRatio] = React.useState<number | null>(null);

	React.useEffect(() => {
		let isCancelled = false;
		Promise.resolve(resolveImageUri(src))
			.then((uri) => {
				if (!isCancelled) setResolvedSrc(uri);
			})
			.catch(() => {
				if (!isCancelled) setResolvedSrc(src);
			});
		return () => {
			isCancelled = true;
			releaseImageUri(src);
		};
	}, [src]);

	const handleLoad = React.useCallback((event: ImageLoadEventData) => {
		const { width, height } = event.source;
		if (width > 0 && height > 0) {
			setAspectRatio(width / height);
		}
	}, []);

	return (
		<Image
			source={{ uri: resolvedSrc }}
			accessibilityLabel={altText}
			alt={altText}
			contentFit="contain"
			onLoad={handleLoad}
			style={[
					{
						width: "100%",
						maxWidth: "100%",
						maxHeight: 360,
						minHeight: 160,
					borderRadius: 4,
				},
				aspectRatio ? { aspectRatio, minHeight: undefined } : null,
			]}
		/>
	);
}
