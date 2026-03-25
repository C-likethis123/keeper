import type { PlatformOSType } from "react-native";

export type EmbeddedVideoLayout = "stacked" | "side";

export interface EmbeddedVideoSource {
	rawUrl: string;
	embedUrl: string;
	host: string;
	label: string;
	kind: "youtube" | "generic";
}

const DESKTOP_LAYOUT_MIN_WIDTH = 960;
const DEFAULT_PROTOCOL = "https://";

function normalizeUrl(input: string): URL | null {
	const trimmed = input.trim();
	if (!trimmed) {
		return null;
	}

	const candidate =
		/^https?:\/\//i.test(trimmed) || /^[a-z]+:\/\//i.test(trimmed)
			? trimmed
			: `${DEFAULT_PROTOCOL}${trimmed}`;

	try {
		const url = new URL(candidate);
		if (!["http:", "https:"].includes(url.protocol)) {
			return null;
		}
		return url;
	} catch {
		return null;
	}
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

		if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
			return url.pathname.split("/").filter(Boolean)[1] ?? null;
		}
	}

	return null;
}

export function parseEmbeddedVideoUrl(input: string): EmbeddedVideoSource | null {
	const url = normalizeUrl(input);
	if (!url) {
		return null;
	}

	const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
	const videoId = extractYouTubeVideoId(url);

	if (videoId) {
		return {
			rawUrl: url.toString(),
			embedUrl: `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&enablejsapi=1`,
			host: hostname,
			label: "YouTube video",
			kind: "youtube",
		};
	}

	return {
		rawUrl: url.toString(),
		embedUrl: url.toString(),
		host: hostname,
		label: hostname,
		kind: "generic",
	};
}

export function getResumeEmbedUrl(
	source: EmbeddedVideoSource,
	startSeconds: number,
): string {
	if (startSeconds <= 0) {
		return source.embedUrl;
	}
	const start = Math.floor(startSeconds);
	if (source.kind === "youtube") {
		return `${source.embedUrl}&start=${start}`;
	}
	return `${source.embedUrl}#t=${start}`;
}

export function getEmbeddedVideoLayout(
	width: number,
	platform: PlatformOSType,
	isDesktopRuntime: boolean,
): EmbeddedVideoLayout {
	if ((isDesktopRuntime || platform === "web") && width >= DESKTOP_LAYOUT_MIN_WIDTH) {
		return "side";
	}

	return "stacked";
}

