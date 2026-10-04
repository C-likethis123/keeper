import {
	releaseImageUri,
	resolveImageUri,
} from "@/services/notes/imageStorage";
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

	const handleLoad = React.useCallback(
		(event: React.SyntheticEvent<HTMLImageElement>) => {
			const { naturalWidth: width, naturalHeight: height } =
				event.currentTarget;
			if (width > 0 && height > 0) {
				setAspectRatio(width / height);
			}
		},
		[],
	);

	return (
		<img
			src={resolvedSrc}
			alt={altText}
			onLoad={handleLoad}
			style={{
				objectFit: "contain",
				width: "100%",
				maxWidth: "100%",
				maxHeight: 360,
				minHeight: 160,
				borderRadius: 4,
				...(aspectRatio ? { aspectRatio, minHeight: undefined } : {}),
			}}
		/>
	);
}
