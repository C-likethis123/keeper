import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
	const isDevelopment = process.env.NODE_ENV === "development";
	const scrollbarStyles = `
		html {
			color-scheme: dark light;
			scrollbar-color: rgba(255, 255, 255, 0.22) #000000;
		}

		body {
			background-color: #000000;
		}

		::-webkit-scrollbar {
			width: 12px;
			height: 12px;
		}

		::-webkit-scrollbar-track {
			background: #000000;
		}

		::-webkit-scrollbar-thumb {
			background: rgba(255, 255, 255, 0.22);
			border-radius: 999px;
			border: 2px solid #000000;
		}

		::-webkit-scrollbar-thumb:hover {
			background: rgba(255, 255, 255, 0.3);
		}

		@media (prefers-color-scheme: light) {
			html {
				scrollbar-color: rgba(17, 24, 39, 0.28) #ffffff;
			}

			body {
				background-color: #ffffff;
			}

			::-webkit-scrollbar-track {
				background: #ffffff;
			}

			::-webkit-scrollbar-thumb {
				background: rgba(17, 24, 39, 0.28);
				border-color: #ffffff;
			}

			::-webkit-scrollbar-thumb:hover {
				background: rgba(17, 24, 39, 0.38);
			}
		}
	`;

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
				<style>{scrollbarStyles}</style>
				<ScrollViewStyleReset />
			</head>
			<body>{children}</body>
		</html>
	);
}
