import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@web/App";
import { registerServiceWorker } from "@web/services/pwa";
import { configureSyncServerUrl } from "@keeper/services/sync/config";
import "@web/styles/global.css";

configureSyncServerUrl(
	import.meta.env.VITE_SYNC_SERVER_URL ??
		import.meta.env.EXPO_PUBLIC_SYNC_SERVER_URL,
);

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
