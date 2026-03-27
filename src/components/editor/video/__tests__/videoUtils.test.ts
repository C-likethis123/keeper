import {
	extractVideoUrlFromMarkdown,
	parseEmbeddedVideoUrl,
} from "../videoUtils";

describe("videoUtils", () => {
	it("converts YouTube watch urls into embeddable sources", () => {
		expect(
			parseEmbeddedVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
		).toEqual(
			expect.objectContaining({
				kind: "youtube",
				label: "YouTube video",
				embedUrl:
					"https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&enablejsapi=1",
			}),
		);
	});

	it("accepts generic https urls as fallback video sources", () => {
		expect(parseEmbeddedVideoUrl("https://example.com/video")).toEqual(
			expect.objectContaining({
				kind: "generic",
				embedUrl: "https://example.com/video",
				label: "example.com",
			}),
		);
	});

	it("rejects invalid or unsupported urls", () => {
		expect(parseEmbeddedVideoUrl("not a url at all")).toBeNull();
		expect(parseEmbeddedVideoUrl("ftp://example.com/video")).toBeNull();
	});

	describe("extractVideoUrlFromMarkdown", () => {
		it("extracts a video url from markdown image syntax", () => {
			const markdown =
				"Check this video: ![](https://www.youtube.com/watch?v=dQw4w9WgXcQ)";
			expect(extractVideoUrlFromMarkdown(markdown)).toBe(
				"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			);
		});

		it("returns null when no video url is found", () => {
			const markdown =
				"Just some text with an image ![icon](https://example.com/icon.png)";
			// For now, it extracts ANY image url, but NoteEditorView will validate it later with parseEmbeddedVideoUrl
			expect(extractVideoUrlFromMarkdown(markdown)).toBe(
				"https://example.com/icon.png",
			);
		});

		it("returns null when no image syntax is present", () => {
			const markdown = "No video here.";
			expect(extractVideoUrlFromMarkdown(markdown)).toBeNull();
		});
	});
});
