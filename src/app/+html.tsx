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

		#keeper-startup-cover {
			position: fixed;
			inset: 0;
			z-index: 2147483647;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 16px;
			background: #000000;
			color: #ffffff;
			font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		}

		#keeper-startup-title {
			font-size: 32px;
			font-weight: 700;
		}

		#keeper-startup-spinner {
			width: 28px;
			height: 28px;
			border: 3px solid rgba(255, 255, 255, 0.25);
			border-top-color: #ffffff;
			border-radius: 999px;
			animation: keeper-startup-spin 0.8s linear infinite;
		}

		@keyframes keeper-startup-spin {
			to { transform: rotate(360deg); }
		}

		input,
		textarea {
			outline: none;
			box-shadow: none;
		}

		input:focus,
		textarea:focus,
		input:focus-visible,
		textarea:focus-visible {
			outline: none;
			box-shadow: none;
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

			#keeper-startup-cover {
				background: #ffffff;
				color: #111827;
			}

			#keeper-startup-spinner {
				border-color: rgba(17, 24, 39, 0.2);
				border-top-color: #111827;
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
			<body>
				<output id="keeper-startup-cover" aria-label="Loading Keeper">
					<span id="keeper-startup-title">Keeper</span>
					<span id="keeper-startup-spinner" />
				</output>
				{children}
			</body>
		</html>
	);
}
