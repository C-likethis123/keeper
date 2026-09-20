import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LexicalEditor } from "@/ui/LexicalEditor";

describe("LexicalEditor", () => {
	it("loads Markdown extensions into a browser contenteditable", () => {
		const onChange = vi.fn();
		render(<LexicalEditor value={"## Browser heading\n\n- task"} onChange={onChange} />);

		const editor = screen.getByLabelText("Note content");
		expect(editor).toHaveTextContent("Browser heading");
		expect(editor).toHaveTextContent("task");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("exposes the core Keeper formatting toolbar", () => {
		render(<LexicalEditor value="" onChange={vi.fn()} />);

		for (const label of ["Undo", "Redo", "Bold", "Italic", "Heading", "Code block", "Quote", "Bulleted list", "Insert table"]) {
			expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
		}
	});
});
