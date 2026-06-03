import {
	DecoratorNode,
	type EditorConfig,
	type LexicalNode,
	type SerializedLexicalNode,
	type Spread,
} from "lexical";
import * as React from "react";
import { Suspense } from "react";

const ImageComponent = React.lazy(() => import("./ImageComponent"));

export interface SerializedImageNode
	extends Spread<{ src: string; altText: string }, SerializedLexicalNode> {}

export class ImageNode extends DecoratorNode<JSX.Element> {
	__src: string;
	__altText: string;

	static getType(): string {
		return "image";
	}

	static clone(node: ImageNode): ImageNode {
		return new ImageNode(node.__src, node.__altText, node.__key);
	}

	constructor(src: string, altText: string, key?: string) {
		super(key);
		this.__src = src;
		this.__altText = altText;
	}

	getSrc(): string {
		return this.__src;
	}

	getAltText(): string {
		return this.__altText;
	}

	createDOM(_config: EditorConfig): HTMLElement {
		const element = document.createElement("img");
		element.className = "image-node";
		return element;
	}

	updateDOM(): false {
		return false;
	}

	static importJSON(serializedNode: SerializedImageNode): ImageNode {
		return $createImageNode(serializedNode.src, serializedNode.altText);
	}

	exportJSON(): SerializedImageNode {
		return {
			src: this.__src,
			altText: this.__altText,
			type: "image",
			version: 1,
		};
	}

	decorate(): JSX.Element {
		return (
			<Suspense fallback={null}>
				<ImageComponent src={this.__src} altText={this.__altText} />
			</Suspense>
		);
	}
}

export function $createImageNode(src: string, altText: string): ImageNode {
	return new ImageNode(src, altText);
}

export function $isImageNode(
	node: LexicalNode | null | undefined,
): node is ImageNode {
	return node instanceof ImageNode;
}
