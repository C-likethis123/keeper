export function getYouTubeVideoId(url: string): string | null {
	const trimmed = url.trim();
	if (!trimmed) {
		return null;
	}

	try {
		const parsed = new URL(trimmed);
		const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

		if (hostname === "youtu.be") {
			return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
		}

		if (hostname === "youtube.com" || hostname === "m.youtube.com") {
			if (parsed.pathname === "/watch") {
				return parsed.searchParams.get("v");
			}

			if (parsed.pathname.startsWith("/embed/")) {
				return parsed.pathname.split("/").filter(Boolean)[1] ?? null;
			}

			if (parsed.pathname.startsWith("/shorts/")) {
				return parsed.pathname.split("/").filter(Boolean)[1] ?? null;
			}
		}
	} catch {
		return null;
	}

	return null;
}

export function getYouTubeEmbedUrl(url: string): string | null {
	const videoId = getYouTubeVideoId(url);
	return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}
