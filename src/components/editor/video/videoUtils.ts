export interface EmbeddedVideoSource {
	rawUrl: string;
	embedUrl: string;
	host: string;
}

function extractYouTubeVideoId(url: URL): string | null {
	const hostname = url.hostname.replace(/^www\./, "").toLowerCase();

	if (hostname === "youtu.be") {
		return url.pathname.split("/").filter(Boolean)[0] ?? null;
	}

	if (hostname === "youtube.com" || hostname === "m.youtube.com") {
		if (url.pathname === "/watch") {
			return url.searchParams.get("v");
		}

		if (
			url.pathname.startsWith("/embed/") ||
			url.pathname.startsWith("/shorts/")
		) {
			return url.pathname.split("/").filter(Boolean)[1] ?? null;
		}
	}

	return null;
}

export function parseEmbeddedVideoUrl(
	input: string,
): EmbeddedVideoSource | null {
	if (!URL.canParse(input)) {
		return null;
	}
	const url = new URL(input);
	const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
	const videoId = extractYouTubeVideoId(url);

	if (!videoId) {
		return null;
	}
	return {
		rawUrl: url.toString(),
		embedUrl: `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`,
		host: hostname,
	};
}

// Returns the page origin used as baseUrl / base-href for YouTube embeds.
// On Tauri desktop (production) the app is served via tauri-plugin-localhost,
// so window.location.origin is already a valid http://localhost:{port} origin
// that YouTube accepts. Returns null only in non-browser environments (e.g. SSR).
// NOTE: Do NOT pass this value as an ?origin= query param to YouTube embed URLs —
// that causes Error 153. Use it only as the document baseUrl / Referer context.
export function resolveVideoEmbedOrigin(): string | null {
	if (process.env.EXPO_PUBLIC_VIDEO_EMBED_ORIGIN) {
		return process.env.EXPO_PUBLIC_VIDEO_EMBED_ORIGIN;
	}

	if (typeof window === "undefined") {
		return null;
	}

	const { origin, protocol } = window.location;
	if (protocol === "http:" || protocol === "https:") {
		return origin;
	}

	return null;
}

export function buildVideoEmbedHtml(embedUrl: string, origin: string): string {
	return `<!DOCTYPE html><html><head><base href="${origin}"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;background:#000;height:100vh;display:flex;justify-content:center;align-items:center"><iframe src="${embedUrl}" style="width:100%;height:100%;border:0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></body></html>`;
}

export type VideoMode = "minimised" | "normal";

export function extractVideoUrlFromMarkdown(markdown: string): string | null {
	// Match ![] (url) syntax, capturing the URL
	const regex = /!\[.*?\]\((https?:\/\/\S+?)\)/;
	const match = markdown.match(regex);
	return match?.[1] ?? null;
}
