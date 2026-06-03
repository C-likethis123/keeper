import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
	$createParagraphNode,
	$insertNodes,
	COMMAND_PRIORITY_EDITOR,
	type LexicalCommand,
	createCommand,
} from "lexical";
import { useEffect } from "react";
import { $createEquationNode, EquationNode } from "./EquationNode";

export const INSERT_EQUATION_COMMAND: LexicalCommand<{
	equation: string;
	inline: boolean;
}> = createCommand("INSERT_EQUATION_COMMAND");

export function EquationPlugin(): JSX.Element | null {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		if (!editor.hasNodes([EquationNode])) {
			throw new Error("EquationPlugin: EquationNode not registered on editor");
		}

		return editor.registerCommand<{ equation: string; inline: boolean }>(
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
		);
	}, [editor]);

	return null;
}
