import { render, screen, waitFor } from "@testing-library/react";
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

		for (const label of ["Undo", "Redo", "Indent", "Outdent", "Bold", "Italic", "Heading", "Code block", "Quote", "Bulleted list", "Numbered list", "Checklist", "Insert table"]) {
			expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
		}
	});

	it("uses Prism syntax highlighting for fenced code blocks", async () => {
		const { container } = render(<LexicalEditor value={"```javascript\nconst answer = 42;\n```"} onChange={vi.fn()} />);

		await waitFor(() => expect(container.querySelector(".lexical-token-keyword")).toHaveTextContent("const"));
	});
});
