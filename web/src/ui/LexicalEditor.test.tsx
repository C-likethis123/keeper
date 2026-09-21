import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LexicalEditor } from "@web/ui/LexicalEditor";

describe("LexicalEditor", () => {
	it("loads canonical Markdown into a browser contenteditable", () => {
		const onChange = vi.fn();
		render(<LexicalEditor value={"## Browser heading\n\n- task"} onChange={onChange} />);

		const editor = screen.getByLabelText("Note content");
		expect(editor).toHaveTextContent("Browser heading");
		expect(editor).toHaveTextContent("task");
		expect(onChange).toHaveBeenCalledWith("## Browser heading\n\n- task");
	});

	it("uses canonical Expo toolbar actions", () => {
		render(<LexicalEditor value="" onChange={vi.fn()} />);

		for (const label of ["Insert table", "Insert image", "Attach PDF or ePub", "Attach video", "View article", "Show related notes", "Switch panel"]) {
			expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
		}
	});

	it("uses canonical code theme classes", async () => {
		const { KEEPER_EDITOR_THEME } = await import("@keeper/components/editor/lexical/keeperEditorTheme");
		expect(KEEPER_EDITOR_THEME.code).toBe("keeper-code");
		expect(KEEPER_EDITOR_THEME.codeHighlight?.keyword).toBe("keeper-token-keyword");
	});
});
