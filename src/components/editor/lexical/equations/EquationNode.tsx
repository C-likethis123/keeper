import {
	DecoratorNode,
	type EditorConfig,
	type LexicalNode,
	type SerializedLexicalNode,
	type Spread,
} from "lexical";
import * as React from "react";
import { Suspense } from "react";

const EquationComponent = React.lazy(() => import("./EquationComponent"));

interface SerializedEquationNode
	extends Spread<
		{ equation: string; inline: boolean },
		SerializedLexicalNode
	> {}

export class EquationNode extends DecoratorNode<JSX.Element> {
	__equation: string;
	__inline: boolean;

	static getType(): string {
		return "equation";
	}

	static clone(node: EquationNode): EquationNode {
		return new EquationNode(node.__equation, node.__inline, node.__key);
	}

	constructor(equation: string, inline: boolean, key?: string) {
		super(key);
		this.__equation = equation;
		this.__inline = inline;
	}

	getEquation(): string {
		return this.__equation;
	}

	isInline(): boolean {
		return this.__inline;
	}

	createDOM(_config: EditorConfig): HTMLElement {
		const element = document.createElement(this.__inline ? "span" : "div");
		element.className = "equation-node";
		return element;
	}

	updateDOM(): false {
		return false;
	}

	static importJSON(serializedNode: SerializedEquationNode): EquationNode {
		return $createEquationNode(serializedNode.equation, serializedNode.inline);
	}

	exportJSON(): SerializedEquationNode {
		return {
			equation: this.__equation,
			inline: this.__inline,
			type: "equation",
			version: 1,
		};
	}

	decorate(): JSX.Element {
		return (
			<Suspense fallback={null}>
				<EquationComponent equation={this.__equation} inline={this.__inline} />
			</Suspense>
		);
	}
}

export function $createEquationNode(
	equation: string,
	inline: boolean,
): EquationNode {
	return new EquationNode(equation, inline);
}

export function $isEquationNode(
	node: LexicalNode | null | undefined,
): node is EquationNode {
	return node instanceof EquationNode;
}
