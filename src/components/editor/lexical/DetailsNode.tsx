import {
	type EditorConfig,
	ElementNode,
	type LexicalNode,
	type SerializedElementNode,
	type Spread,
} from "lexical";

interface SerializedDetailsNode extends SerializedElementNode {}
interface SerializedDetailsSummaryNode
	extends Spread<{ type: "details-summary" }, SerializedElementNode> {}
interface SerializedDetailsContentNode
	extends Spread<{ type: "details-content" }, SerializedElementNode> {}

export class DetailsNode extends ElementNode {
	static getType(): string {
		return "details";
	}

	static clone(node: DetailsNode): DetailsNode {
		return new DetailsNode(node.__key);
	}

	createDOM(_config: EditorConfig): HTMLElement {
		const element = document.createElement("details");
		element.className = "details-node";
		element.open = true;
		return element;
	}

	updateDOM(): false {
		return false;
	}

	static importJSON(_serializedNode: SerializedDetailsNode): DetailsNode {
		return $createDetailsNode();
	}

	exportJSON(): SerializedDetailsNode {
		return {
			...super.exportJSON(),
			type: "details",
			version: 1,
		};
	}
}

export class DetailsSummaryNode extends ElementNode {
	static getType(): string {
		return "details-summary";
	}

	static clone(node: DetailsSummaryNode): DetailsSummaryNode {
		return new DetailsSummaryNode(node.__key);
	}

	createDOM(_config: EditorConfig): HTMLElement {
		const element = document.createElement("summary");
		element.className = "details-summary-node";
		return element;
	}

	updateDOM(): false {
		return false;
	}

	static importJSON(
		_serializedNode: SerializedDetailsSummaryNode,
	): DetailsSummaryNode {
		return $createDetailsSummaryNode();
	}

	exportJSON(): SerializedDetailsSummaryNode {
		return {
			...super.exportJSON(),
			type: "details-summary",
			version: 1,
		};
	}
}

export class DetailsContentNode extends ElementNode {
	static getType(): string {
		return "details-content";
	}

	static clone(node: DetailsContentNode): DetailsContentNode {
		return new DetailsContentNode(node.__key);
	}

	createDOM(_config: EditorConfig): HTMLElement {
		const element = document.createElement("div");
		element.className = "details-content-node";
		return element;
	}

	updateDOM(): false {
		return false;
	}

	static importJSON(
		_serializedNode: SerializedDetailsContentNode,
	): DetailsContentNode {
		return $createDetailsContentNode();
	}

	exportJSON(): SerializedDetailsContentNode {
		return {
			...super.exportJSON(),
			type: "details-content",
			version: 1,
		};
	}
}

export function $createDetailsNode(): DetailsNode {
	return new DetailsNode();
}

export function $createDetailsSummaryNode(): DetailsSummaryNode {
	return new DetailsSummaryNode();
}

export function $createDetailsContentNode(): DetailsContentNode {
	return new DetailsContentNode();
}

export function $isDetailsNode(
	node: LexicalNode | null | undefined,
): node is DetailsNode {
	return node instanceof DetailsNode;
}

export function $isDetailsSummaryNode(
	node: LexicalNode | null | undefined,
): node is DetailsSummaryNode {
	return node instanceof DetailsSummaryNode;
}

export function $isDetailsContentNode(
	node: LexicalNode | null | undefined,
): node is DetailsContentNode {
	return node instanceof DetailsContentNode;
}
