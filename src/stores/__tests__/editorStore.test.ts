import { useEditorState } from "../editorStore";

describe("editorStore", () => {
	beforeEach(() => {
		useEditorState.getState().resetState();
	});

	it("preserves loaded markdown as canonical content for autosave", () => {
		const markdown = "![Diagram](_attachments/diagram.png)\n\n$$\na + b\n$$";
		const store = useEditorState.getState();

		store.loadMarkdown(markdown);
		store.prepareContent();

		expect(useEditorState.getState().getPreparedContent()).toEqual({
			version: useEditorState.getState().markdownVersion,
			markdown,
		});
		expect(useEditorState.getState().getContent()).toBe(markdown);
	});

	it("increments markdown version for editor markdown changes", () => {
		const store = useEditorState.getState();

		store.loadMarkdown("Alpha");
		const baselineVersion = useEditorState.getState().markdownVersion;
		store.setCurrentMarkdown("Beta");

		expect(useEditorState.getState().markdownVersion).toBe(
			baselineVersion + 1,
		);
		expect(useEditorState.getState().getContent()).toBe("Beta");
	});

	it("clears prepared markdown after editor markdown changes", () => {
		const store = useEditorState.getState();

		store.loadMarkdown("Alpha");
		store.prepareContent();
		expect(useEditorState.getState().getPreparedContent()).toEqual({
			version: useEditorState.getState().markdownVersion,
			markdown: "Alpha",
		});

		store.setCurrentMarkdown("Beta");

		expect(useEditorState.getState().getPreparedContent()).toBeNull();
		expect(useEditorState.getState().getContent()).toBe("Beta");
	});

	it("uses empty markdown until the Lexical editor reports markdown", () => {
		useEditorState.setState({
			currentMarkdown: null,
			preparedMarkdown: null,
			preparedVersion: null,
		});

		expect(useEditorState.getState().getContent()).toBe("");
	});

	it("resetState clears markdown persistence state", () => {
		useEditorState.getState().loadMarkdown("Alpha");
		useEditorState.getState().setCurrentMarkdown("Beta");
		useEditorState.getState().prepareContent();

		useEditorState.getState().resetState();

		const state = useEditorState.getState();
		expect(state.currentMarkdown).toBeNull();
		expect(state.markdownVersion).toBe(0);
		expect(state.getPreparedContent()).toBeNull();
	});
});
