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

// Returns the page origin for YouTube's postMessage API, or null when the
// runtime protocol isn't a real web origin (e.g. tauri:// in production).
// NOTE: This should ONLY be used for the Referer header and referrer policy.
// Passing this as an Origin header or ?origin= URL parameter to YouTube
// embeds often causes Error 153.
export function resolveVideoEmbedOrigin(): string | null {
	if (process.env.EXPO_PUBLIC_VIDEO_EMBED_ORIGIN) {
		return process.env.EXPO_PUBLIC_VIDEO_EMBED_ORIGIN;
	}

	if (
		typeof window === "undefined" ||
		!window.location ||
		typeof window.location.origin !== "string" ||
		typeof window.location.protocol !== "string"
	) {
		return null;
	}

	const { origin, protocol } = window.location;
	if (protocol === "http:" || protocol === "https:") {
		return origin;
	}

	return null;
}

export type VideoMode = "minimised" | "normal";

export function extractVideoUrlFromMarkdown(markdown: string): string | null {
	// Match ![] (url) syntax, capturing the URL
	const regex = /!\[.*?\]\((https?:\/\/\S+?)\)/;
	const match = markdown.match(regex);
	return match?.[1] ?? null;
}
