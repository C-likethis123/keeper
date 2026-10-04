import { MathView } from "@/components/editor/lexical/equations/MathView";
import ImageComponent from "@/components/editor/lexical/image/ImageComponent";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const images = vi.hoisted(() => ({
	resolveImageUri: vi.fn(async () => "blob:stored-image"),
	releaseImageUri: vi.fn(),
}));

vi.mock("@/services/notes/imageStorage", () => images);
vi.mock("@/hooks/useExtendedTheme", () => ({
	useExtendedTheme: () => ({ colors: { text: "#111111", error: "#ff0000" } }),
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

it("loads stored image, sizes from intrinsic dimensions, and releases URI", async () => {
	const { unmount } = render(
		<ImageComponent src="_images/photo.png" altText="Photo" />,
	);
	const image = screen.getByRole("img", { name: "Photo" });
	await waitFor(() =>
		expect(image).toHaveAttribute("src", "blob:stored-image"),
	);
	expect(images.resolveImageUri).toHaveBeenCalledWith("_images/photo.png");
	Object.defineProperties(image, {
		naturalWidth: { value: 640 },
		naturalHeight: { value: 320 },
	});
	fireEvent.load(image);
	expect(image).toHaveStyle({ aspectRatio: "2", objectFit: "contain" });
	expect(image.style.minHeight).toBe("");
	unmount();
	expect(images.releaseImageUri).toHaveBeenCalledWith("_images/photo.png");
});

it("renders inline and display equations with KaTeX", async () => {
	const { container, rerender } = render(<MathView expression="x^2" />);
	await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());
	expect(container.firstElementChild?.tagName).toBe("SPAN");
	expect(container.querySelector(".katex-display")).toBeNull();
	rerender(<MathView expression="x^2" displayMode />);
	await waitFor(() =>
		expect(container.querySelector(".katex-display")).not.toBeNull(),
	);
	expect(container.firstElementChild?.tagName).toBe("DIV");
});
