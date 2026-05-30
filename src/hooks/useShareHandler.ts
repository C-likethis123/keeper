import { parseEmbeddedVideoUrl } from "@/components/editor/video/videoUtils";
import { NoteService } from "@/services/notes/noteService";
import type { NoteSaveInput } from "@/services/notes/types";
import { showToast } from "@/services/toast";
import { useRouter } from "expo-router";
import { useShareIntent } from "expo-share-intent";
import { nanoid } from "nanoid";
import { useEffect } from "react";

function extractFirstHttpUrl(input?: string | null): string | null {
	const rawUrl = input
		?.match(/https?:\/\/\S+/)?.[0]
		?.replace(/[).,;:!?"'[\]]+$/, "");
	if (!rawUrl || !URL.canParse(rawUrl)) {
		return null;
	}
	const url = new URL(rawUrl);
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return null;
	}
	return url.toString();
}

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">");
}

function extractMetaContent(html: string, property: string): string | null {
	const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const metaPattern = new RegExp(
		`<meta\\s+[^>]*(?:property|name)=["']${escapedProperty}["'][^>]*content=["']([^"']+)["'][^>]*>`,
		"i",
	);
	const reversedMetaPattern = new RegExp(
		`<meta\\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${escapedProperty}["'][^>]*>`,
		"i",
	);
	const match = html.match(metaPattern) ?? html.match(reversedMetaPattern);
	return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

function extractPageTitle(html: string): string | null {
	const title =
		extractMetaContent(html, "og:title") ??
		extractMetaContent(html, "twitter:title") ??
		html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
	if (!title) {
		return null;
	}
	return decodeHtmlEntities(title.replace(/\s+/g, " "));
}

function titleFromUrl(url: string): string {
	const parsed = new URL(url);
	return parsed.hostname.replace(/^www\./, "");
}

async function fetchArticleTitle(url: string): Promise<string> {
	try {
		const response = await fetch(url, {
			headers: { Accept: "text/html,application/xhtml+xml" },
		});
		if (!response.ok) {
			return titleFromUrl(url);
		}
		const html = await response.text();
		return extractPageTitle(html) ?? titleFromUrl(url);
	} catch {
		return titleFromUrl(url);
	}
}

async function fetchVideoTitle(url: string): Promise<string> {
	try {
		const oembedRes = await fetch(
			`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
		);
		if (!oembedRes.ok) {
			return "YouTube Video";
		}
		const oembedData = (await oembedRes.json()) as { title?: string };
		return oembedData.title ?? "YouTube Video";
	} catch {
		return "YouTube Video";
	}
}

function getSharedUrl(webUrl?: string | null, text?: string | null): string | null {
	return extractFirstHttpUrl(webUrl) ?? extractFirstHttpUrl(text);
}

async function buildSharedResourceNote(url: string): Promise<NoteSaveInput> {
	const isVideo = parseEmbeddedVideoUrl(url) !== null;
	const resourceTitle = isVideo
		? await fetchVideoTitle(url)
		: await fetchArticleTitle(url);

	return {
		id: nanoid(),
		title: `Resource: ${resourceTitle}`,
		content: isVideo ? `![video](${url})\n\nShared from YouTube.` : "",
		isPinned: false,
		noteType: "resource",
		status: null,
		attachedVideo: isVideo ? url : null,
		resourceUrl: isVideo ? null : url,
	};
}

export function useShareHandler(isHydrated: boolean) {
	const { hasShareIntent, shareIntent, resetShareIntent, error } =
		useShareIntent();
	const router = useRouter();
	useEffect(() => {
		if (error) {
			console.error("[ShareHandler] Error:", error);
			showToast(`Share Error: ${error}`);
			resetShareIntent();
		}
	}, [error, resetShareIntent]);

	useEffect(() => {
		if (
			!isHydrated ||
			!hasShareIntent ||
			(!shareIntent.webUrl && !shareIntent.text)
		) {
			return;
		}

		const processShareIntent = async () => {
			const sharedUrl = getSharedUrl(shareIntent.webUrl, shareIntent.text);
			if (!sharedUrl) {
				showToast("No link found in shared content");
				resetShareIntent();
				return;
			}

			console.log("[ShareHandler] Processing share intent:", sharedUrl);

			try {
				const noteInput = await buildSharedResourceNote(sharedUrl);
				const newNote = await NoteService.saveNote(noteInput, true);

				console.log("[ShareHandler] Created new note:", newNote.id);
				resetShareIntent();
				router.push(`/editor?id=${newNote.id}`);
				showToast(
					noteInput.attachedVideo
						? "New resource note created from shared video"
						: "New resource note created from shared link",
				);
			} catch (err) {
				console.error("[ShareHandler] Failed to create note:", err);
				showToast("Failed to create note from shared content");
				resetShareIntent();
			}
		};

		void processShareIntent();
	}, [
		isHydrated,
		hasShareIntent,
		shareIntent.webUrl,
		shareIntent.text,
		resetShareIntent,
		router,
	]);
}
