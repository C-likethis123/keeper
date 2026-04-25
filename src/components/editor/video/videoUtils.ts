export interface EmbeddedVideoSource {
	rawUrl: string;
	embedUrl: string;
	host: string;
}

export const VIDEO_EMBED_FALLBACK_ORIGIN = "https://keeper.app";

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
		embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&enablejsapi=1`,
		host: hostname,
	};
}

export function resolveVideoEmbedOrigin(): string {
	if (
		typeof window === "undefined" ||
		!window.location ||
		typeof window.location.origin !== "string" ||
		typeof window.location.protocol !== "string"
	) {
		return VIDEO_EMBED_FALLBACK_ORIGIN;
	}

	const { origin, protocol } = window.location;
	if (protocol === "http:" || protocol === "https:") {
		return origin;
	}

	return VIDEO_EMBED_FALLBACK_ORIGIN;
}

export type VideoMode = "minimised" | "normal";

export function extractVideoUrlFromMarkdown(markdown: string): string | null {
	// Match ![] (url) syntax, capturing the URL
	const regex = /!\[.*?\]\((https?:\/\/\S+?)\)/;
	const match = markdown.match(regex);
	return match?.[1] ?? null;
}
