import * as React from "react";

export default function ImageComponent({
	src,
	altText,
}: {
	src: string;
	altText: string;
}): JSX.Element {
	return (
		<img
			src={src}
			alt={altText}
			style={{
				maxWidth: "100%",
				borderRadius: "4px",
				display: "block",
			}}
		/>
	);
}
