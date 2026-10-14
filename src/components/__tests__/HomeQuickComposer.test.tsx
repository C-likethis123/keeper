import HomeQuickComposer from "@/components/HomeQuickComposer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@/hooks/useStyles", () => ({
	useStyles: () => ({ pinIcon: { color: "gray" }, pinIconPinned: { color: "blue" } }),
}));
vi.mock("@/hooks/useBrowserAppearance", () => ({
	useColorScheme: () => "dark",
}));
vi.mock("@/components/editor/lexical/LexicalMarkdownEditor", () => ({
	default: (props: {
		markdown: string;
		onInsertTemplateCommand: () => void;
		onShowVideoModal: () => void;
	}) => (
		<>
			<p>{props.markdown}</p>
			<button type="button" onClick={props.onInsertTemplateCommand}>
				Template
			</button>
			<button type="button" onClick={props.onShowVideoModal}>
				Video
			</button>
		</>
	),
}));

it("opens template picker and saves applied content from compact editor", async () => {
	const onSave = vi.fn().mockResolvedValue(undefined);
	render(
		<HomeQuickComposer
			onCreateTypedNote={vi.fn()}
			onSave={onSave}
			renderTemplatePicker={({ open, onApply, onDismiss }) =>
				open ? (
					<dialog open aria-label="Templates">
						<button
							type="button"
							onClick={() => {
								onApply("Template body");
								onDismiss();
							}}
						>
							Apply template
						</button>
					</dialog>
				) : null
			}
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Take a note" }));
	fireEvent.click(screen.getByRole("button", { name: "Template" }));
	expect(screen.getByRole("dialog", { name: "Templates" })).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Apply template" }));
	expect(screen.queryByRole("dialog")).toBeNull();
	expect(screen.getByText("Template body")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Video" }));
	expect(
		screen.getByRole("dialog", { name: "Attach Video Modal" }),
	).toBeVisible();
	fireEvent.change(
		screen.getByPlaceholderText("https://www.youtube.com/watch?v=..."),
		{
			target: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
		},
	);
	fireEvent.click(screen.getByRole("button", { name: "Save" }));
	fireEvent.click(screen.getByRole("button", { name: "Close note" }));
	await waitFor(() =>
		expect(onSave).toHaveBeenCalledWith({
			title: "",
			content: "Template body",
			isPinned: false,
			attachedVideo: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
		}),
	);
});
