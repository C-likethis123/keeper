import { useState } from "react";

export function normalizeBrowserUrl(value: string): string | null {
	const input = value.trim();
	if (!input) return null;
	const hasScheme =
		/^[a-z][a-z\d+.-]*:/i.test(input) && !/^[^/:\s]+:\d+(?:\/|$)/.test(input);
	try {
		const url = new URL(hasScheme ? input : `https://${input}`);
		if (
			!["http:", "https:"].includes(url.protocol) ||
			url.username ||
			url.password
		)
			return null;
		return url.href;
	} catch {
		return null;
	}
}

export function BrowserWebPanel({
	initialUrl,
	onDismiss,
}: { initialUrl: string | null; onDismiss: () => void }) {
	const [url, setUrl] = useState(() => normalizeBrowserUrl(initialUrl ?? ""));
	const [address, setAddress] = useState(initialUrl ?? "");
	const [error, setError] = useState("");
	const [revision, setRevision] = useState(0);
	return (
		<section className="browser-web-panel" aria-label="Browser pane">
			<form
				className="browser-web-toolbar"
				onSubmit={(event) => {
					event.preventDefault();
					const next = normalizeBrowserUrl(address);
					if (!next) {
						setError("Enter a valid HTTP or HTTPS address.");
						return;
					}
					setError("");
					setAddress(next);
					setUrl(next);
					setRevision((current) => current + 1);
				}}
			>
				<input
					aria-label="Website address"
					aria-invalid={!!error}
					aria-describedby={error ? "browser-address-error" : undefined}
					placeholder="https://example.com"
					value={address}
					onChange={(event) => setAddress(event.target.value)}
				/>
				<button type="submit">Go</button>
				<button
					type="button"
					disabled={!url}
					onClick={() => setRevision((current) => current + 1)}
				>
					Reload
				</button>
				<button
					type="button"
					aria-label="Close browser pane"
					onClick={onDismiss}
				>
					Close
				</button>
			</form>
			{error && (
				<p id="browser-address-error" role="alert">
					{error}
				</p>
			)}
			{url ? (
				<>
					<p className="browser-web-hint">
						Page blank or blocked?{" "}
						<a href={url} target="_blank" rel="noopener noreferrer">
							Open externally
						</a>
					</p>
					<iframe
						key={`${url}:${revision}`}
						src={url}
						title="Browser website"
						sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
						referrerPolicy="no-referrer"
					/>
				</>
			) : (
				<p className="browser-web-hint">
					Enter a website address to browse beside your note.
				</p>
			)}
		</section>
	);
}
