import {
	$createNodeSelection,
	$createParagraphNode,
	$createTextNode,
	$getRoot,
	$getSelection,
	$isRangeSelection,
	$isTextNode,
	$setSelection,
	createEditor,
	KEY_ENTER_COMMAND,
	SELECTION_CHANGE_COMMAND,
} from "lexical";
import { EquationExtension } from "../EquationExtension";
import {
	$createEquationNode,
	$isEquationNode,
	EquationNode,
} from "../EquationNode";

function createTestEditor() {
	const editor = createEditor({
		namespace: "KeeperEquationEditTest",
		nodes: [EquationNode],
		onError: (error) => {
			throw error;
		},
	});
	const unregister =
		EquationExtension.register?.(editor, {}, {} as never) ?? (() => {});
	return { editor, unregister };
}

describe("EquationExtension", () => {
	it("opens an editable block equation when Enter follows $$", () => {
		const { editor, unregister } = createTestEditor();
		const preventDefault = jest.fn();

		editor.update(
			() => {
				const trigger = $createTextNode("$$");
				$getRoot().append($createParagraphNode().append(trigger));
				trigger.selectEnd();

				expect(
					editor.dispatchCommand(KEY_ENTER_COMMAND, {
						preventDefault,
					} as unknown as KeyboardEvent),
				).toBe(true);
			},
			{ discrete: true },
		);

		expect(preventDefault).toHaveBeenCalledTimes(1);
		editor.getEditorState().read(() => {
			expect($getRoot().getTextContent()).toBe("$$$$");
			const selection = $getSelection();
			expect($isRangeSelection(selection)).toBe(true);
			if ($isRangeSelection(selection)) {
				expect(selection.anchor.offset).toBe(2);
				expect(selection.focus.offset).toBe(2);
			}
		});

		unregister();
	});

	it("expands selected inline equations into editable markdown", () => {
		const { editor, unregister } = createTestEditor();

		editor.update(
			() => {
				const equation = $createEquationNode("x + y", true);
				$getRoot().append(
					$createParagraphNode().append(
						$createTextNode("Before "),
						equation,
						$createTextNode(" after"),
					),
				);
				const selection = $createNodeSelection();
				selection.add(equation.getKey());
				$setSelection(selection);
				editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
			},
			{ discrete: true },
		);

		editor.getEditorState().read(() => {
			expect($getRoot().getTextContent()).toBe("Before $x + y$ after");
			const selection = $getSelection();
			expect($isRangeSelection(selection)).toBe(true);
			if ($isRangeSelection(selection)) {
				expect(selection.anchor.offset).toBe(1);
			}
		});

		unregister();
	});

	it("reparses edited inline markdown after caret leaves", () => {
		const { editor, unregister } = createTestEditor();

		editor.update(
			() => {
				const equation = $createEquationNode("x", true);
				const outside = $createTextNode(" after");
				$getRoot().append($createParagraphNode().append(equation, outside));
				const selection = $createNodeSelection();
				selection.add(equation.getKey());
				$setSelection(selection);
				editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);

				const expanded = $getRoot().getFirstDescendant();
				if (!$isTextNode(expanded)) {
					throw new Error("Expected expanded equation markdown");
				}
				expanded.setTextContent("$y + z$");
				outside.selectStart();
				editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
			},
			{ discrete: true },
		);

		editor.getEditorState().read(() => {
			const equation = $getRoot().getFirstDescendant();
			expect($isEquationNode(equation)).toBe(true);
			if ($isEquationNode(equation)) {
				expect(equation.getEquation()).toBe("y + z");
				expect(equation.isInline()).toBe(true);
			}
		});

		unregister();
	});

	it("expands and reparses block equations", () => {
		const { editor, unregister } = createTestEditor();

		editor.update(
			() => {
				const equation = $createEquationNode("x = 1", false);
				$getRoot().append(equation, $createParagraphNode().append($createTextNode("after")));
				const selection = $createNodeSelection();
				selection.add(equation.getKey());
				$setSelection(selection);
				editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);

				const expanded = $getRoot().getFirstDescendant();
				if (!$isTextNode(expanded)) {
					throw new Error("Expected expanded equation markdown");
				}
				expect(expanded.getTextContent()).toBe("$$x = 1$$");
				expanded.setTextContent("$$x = 2$$");
				$getRoot().getLastDescendant()?.selectStart();
				editor.dispatchCommand(SELECTION_CHANGE_COMMAND, undefined);
			},
			{ discrete: true },
		);

		editor.getEditorState().read(() => {
			const equation = $getRoot().getFirstChild();
			expect($isEquationNode(equation)).toBe(true);
			if ($isEquationNode(equation)) {
				expect(equation.getEquation()).toBe("x = 2");
				expect(equation.isInline()).toBe(false);
			}
		});

		unregister();
	});
});
