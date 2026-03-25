import {
	getEmbeddedVideoLayout,
	getResumeEmbedUrl,
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

	it("uses side layout for wide desktop surfaces and stacked otherwise", () => {
		expect(getEmbeddedVideoLayout(1280, "web", true)).toBe("side");
		expect(getEmbeddedVideoLayout(800, "web", true)).toBe("stacked");
		expect(getEmbeddedVideoLayout(1280, "ios", false)).toBe("stacked");
	});

	it("appends start parameter to a YouTube embed url when a resume time is given", () => {
		const source = parseEmbeddedVideoUrl(
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		);
		if (!source) throw new Error("Source not found");
		expect(getResumeEmbedUrl(source, 42)).toBe(
			"https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&enablejsapi=1&start=42",
		);
	});

	it("appends time fragment to a generic embed url", () => {
		const source = parseEmbeddedVideoUrl("https://example.com/video.mp4");
		if (!source) throw new Error("Source not found");
		expect(getResumeEmbedUrl(source, 90)).toBe(
			"https://example.com/video.mp4#t=90",
		);
	});

	it("returns the base embed url unchanged when start time is 0 or below", () => {
		const source = parseEmbeddedVideoUrl(
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		);
		if (!source) throw new Error("Source not found");
		expect(getResumeEmbedUrl(source, 0)).toBe(
			"https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&enablejsapi=1",
		);
	});

	it("returns the base embed url unchanged when startSeconds is NaN", () => {
		const source = parseEmbeddedVideoUrl(
			"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		);
		if (!source) throw new Error("Source not found");
		expect(getResumeEmbedUrl(source, Number.NaN)).toBe(
			"https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&enablejsapi=1",
		);
	});
});
