import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@web/App";
import { registerServiceWorker } from "@web/services/pwa";
import "@web/styles/global.css";

const root = document.getElementById("root");

if (!root) {
	throw new Error("Missing #root element");
}

createRoot(root).render(
	<StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</StrictMode>,
);

registerServiceWorker();
