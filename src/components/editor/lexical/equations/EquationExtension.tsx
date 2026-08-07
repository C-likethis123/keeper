import {
	$createParagraphNode,
	$createTextNode,
	$getNodeByKey,
	$getSelection,
	$insertNodes,
	$isNodeSelection,
	$isParagraphNode,
	$isRangeSelection,
	$isTextNode,
	COMMAND_PRIORITY_HIGH,
	COMMAND_PRIORITY_EDITOR,
	COMMAND_PRIORITY_LOW,
	KEY_ENTER_COMMAND,
	SELECTION_CHANGE_COMMAND,
	type LexicalCommand,
	type NodeKey,
	createCommand,
	defineExtension,
	mergeRegister,
} from "lexical";
import {
	$createEquationNode,
	$isEquationNode,
	EquationNode,
} from "./EquationNode";

const INSERT_EQUATION_COMMAND: LexicalCommand<{
	equation: string;
	inline: boolean;
}> = createCommand("INSERT_EQUATION_COMMAND");

export const EquationExtension = defineExtension({
	name: "keeper/Equation",
	register(editor) {
		if (!editor.hasNodes([EquationNode])) {
			throw new Error("EquationExtension: EquationNode not registered on editor");
		}

		let expandedNodeKey: NodeKey | null = null;
		let expandedInline = true;

		return mergeRegister(
			editor.registerCommand(
				KEY_ENTER_COMMAND,
				(event: KeyboardEvent | null) => {
					const selection = $getSelection();
					if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
						return false;
					}

					const textNode = selection.anchor.getNode();
					const paragraph = textNode.getParent();
					if (
						!$isTextNode(textNode) ||
						!$isParagraphNode(paragraph) ||
						paragraph.getChildrenSize() !== 1 ||
						textNode.getTextContent() !== "$$" ||
						selection.anchor.offset !== 2
					) {
						return false;
					}

					event?.preventDefault();
					textNode.setTextContent("$$$$").toggleUnmergeable();
					textNode.select(2, 2);
					expandedNodeKey = textNode.getKey();
					expandedInline = false;
					return true;
				},
				COMMAND_PRIORITY_HIGH,
			),
			editor.registerCommand<{ equation: string; inline: boolean }>(
				INSERT_EQUATION_COMMAND,
				(payload) => {
					const { equation, inline } = payload;
					const equationNode = $createEquationNode(equation, inline);

					$insertNodes([equationNode]);
					if ($createParagraphNode().append(equationNode)) {
						// This ensures the node is wrapped in a paragraph if necessary
					}

					return true;
				},
				COMMAND_PRIORITY_EDITOR,
			),
			editor.registerCommand(
				SELECTION_CHANGE_COMMAND,
				() => {
					const selection = $getSelection();

					if (expandedNodeKey) {
						const expandedNode = $getNodeByKey(expandedNodeKey);
						if (
							$isRangeSelection(selection) &&
							expandedNode?.is(selection.anchor.getNode())
						) {
							return false;
						}

						if ($isTextNode(expandedNode)) {
							const delimiter = expandedInline ? "$" : "$$";
							const markdown = expandedNode.getTextContent();
							const equation = markdown
								.slice(delimiter.length, -delimiter.length)
								.trim();
							const hasDelimiters =
								markdown.startsWith(delimiter) &&
								markdown.endsWith(delimiter) &&
								markdown.length > delimiter.length * 2;

							if (hasDelimiters && equation) {
								const equationNode = $createEquationNode(equation, expandedInline);
								const parent = expandedNode.getParent();
								if (
									!expandedInline &&
									$isParagraphNode(parent) &&
									parent.getChildrenSize() === 1
								) {
									parent.replace(equationNode);
								} else {
									expandedNode.replace(equationNode);
								}
							} else {
								expandedNode.toggleUnmergeable();
							}
						}
						expandedNodeKey = null;
					}

					if (!$isNodeSelection(selection)) {
						return false;
					}

					const equationNode = selection.getNodes().find($isEquationNode);
					if (!equationNode) {
						return false;
					}

					expandedInline = equationNode.isInline();
					const delimiter = expandedInline ? "$" : "$$";
					const markdownNode = $createTextNode(
						`${delimiter}${equationNode.getEquation()}${delimiter}`,
					).toggleUnmergeable();

					if (expandedInline) {
						equationNode.replace(markdownNode);
					} else {
						equationNode.replace($createParagraphNode().append(markdownNode));
					}
					markdownNode.select(delimiter.length, delimiter.length);
					expandedNodeKey = markdownNode.getKey();
					return false;
				},
				COMMAND_PRIORITY_LOW,
			),
		);
	},
});
