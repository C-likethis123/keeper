import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
	const isDevelopment = process.env.NODE_ENV === "development";

	return (
		<html lang="en">
			<head>
				{isDevelopment ? <script src="http://localhost:8097" /> : null}
				<meta charSet="utf-8" />
				<meta httpEquiv="X-UA-Compatible" content="IE=edge" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1, shrink-to-fit=no"
				/>
				<link
					rel="stylesheet"
					href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
				/>
				<ScrollViewStyleReset />
			</head>
			<body>{children}</body>
		</html>
	);
}
