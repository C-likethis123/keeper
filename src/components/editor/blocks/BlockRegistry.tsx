import React from "react";
import { type BlockNode, BlockType } from "../core/BlockNode";
import { BlockRenderer } from "./BlockRenderer";
import { UnifiedBlock } from "./UnifiedBlock";

const LazyCodeBlock = React.lazy(() =>
	import("./CodeBlock").then((module) => ({ default: module.CodeBlock })),
);

const LazyMathBlock = React.lazy(() =>
	import("./MathBlock").then((module) => ({ default: module.MathBlock })),
);

const LazyImageBlock = React.lazy(() =>
	import("./ImageBlock").then((module) => ({ default: module.ImageBlock })),
);

const LazyVideoBlock = React.lazy(() =>
	import("./VideoBlock").then((module) => ({ default: module.VideoBlock })),
);

export interface BlockConfig {
	block: BlockNode;
	index: number;
	isFocused: boolean;
	onContentChange: (index: number, content: string) => void;
	onBlockTypeChange?: (
		index: number,
		newType: BlockType,
		language?: string,
	) => void;
	onBackspaceAtStart: (index: number) => void;
	onSpace: (index: number, cursorOffset: number) => boolean;
	onEnter: (index: number, cursorOffset: number) => void;
	onSelectionChange: (index: number, start: number, end: number) => void;
	onDelete: (index: number) => void;
	listItemNumber?: number; // For numbered list items
	onCheckboxToggle: (index: number) => void;
	onOpenWikiLink: (title: string) => void;
}

interface BlockBuilder {
	type: BlockType;
	triggerPrefix?: RegExp;
	markdownPrefix: string;
	build: (config: BlockConfig) => React.ReactElement;
}

/// Registry for block builders
///
/// The registry maps block types to their builders, allowing for
/// extensible block type support.
class BlockRegistry {
	private builders = new Map<BlockType, BlockBuilder>();

	/// Registers a builder for a block type
	register(builder: BlockBuilder): void {
		this.builders.set(builder.type, builder);
	}

	/// Registers multiple builders
	registerAll(builders: BlockBuilder[]): void {
		for (const builder of builders) {
			this.register(builder);
		}
	}

	/// Gets the builder for a block type
	getBuilder(type: BlockType): BlockBuilder | undefined {
		return this.builders.get(type);
	}

	/// Builds a component for a block
	build(config: BlockConfig): React.ReactElement {
		const builder = this.builders.get(config.block.type);
		if (!builder) {
			return this.buildFallback(config);
		}
		return builder.build(config);
	}

	/// Fallback component for unknown block types
	private buildFallback(config: BlockConfig): React.ReactElement {
		return React.createElement(BlockRenderer, {
			block: config.block,
			index: config.index,
			isFocused: config.isFocused,
		});
	}

	/// Detects block type from text input (e.g., "# " -> heading1)
	detectBlockType(text: string): {
		type: BlockType;
		prefix: string;
		remainingContent: string;
		language?: string;
	} | null {
		for (const builder of this.builders.values()) {
			const prefix = builder.triggerPrefix;
			if (!prefix) {
				continue;
			}
			const match = text.match(prefix);
			if (match) {
				return {
					type: builder.type,
					prefix: match[0],
					remainingContent: text.substring(match[0].length),
					language:
						builder.type === BlockType.codeBlock
							? (match[1] ?? "plaintext")
							: undefined,
				};
			}
		}
		return null;
	}

	/// Gets all registered block types
	get registeredTypes(): BlockType[] {
		return Array.from(this.builders.keys());
	}
}

// Singleton instance
export const blockRegistry = new BlockRegistry();

function renderLazyBlock(
	BlockComponent: React.LazyExoticComponent<
		(config: BlockConfig) => React.ReactElement
	>,
	config: BlockConfig,
): React.ReactElement {
	return (
		<React.Suspense
			fallback={
				<BlockRenderer
					block={config.block}
					index={config.index}
					isFocused={config.isFocused}
				/>
			}
		>
			<BlockComponent {...config} />
		</React.Suspense>
	);
}

// Register default builders
blockRegistry.registerAll([
	{
		type: BlockType.paragraph,
		markdownPrefix: "",
		build: (config) => <UnifiedBlock {...config} />,
	},
	{
		type: BlockType.heading1,
		triggerPrefix: /^#\s/,
		markdownPrefix: "# ",
		build: (config) => <UnifiedBlock {...config} />,
	},
	{
		type: BlockType.heading2,
		triggerPrefix: /^##\s/,
		markdownPrefix: "## ",
		build: (config) => <UnifiedBlock {...config} />,
	},
	{
		type: BlockType.heading3,
		triggerPrefix: /^###\s/,
		markdownPrefix: "### ",
		build: (config) => <UnifiedBlock {...config} />,
	},
	{
		type: BlockType.checkboxList,
		triggerPrefix: /^-\s\[[ xX]\]\s/,
		markdownPrefix: "- [ ] ",
		build: (config) => <UnifiedBlock {...config} />,
	},
	{
		type: BlockType.bulletList,
		triggerPrefix: /^-\s/,
		markdownPrefix: "- ",
		build: (config) => <UnifiedBlock {...config} />,
	},
	{
		type: BlockType.numberedList,
		triggerPrefix: /^(\d+)\.\s/,
		markdownPrefix: "1. ",
		build: (config) => <UnifiedBlock {...config} />,
	},
	{
		type: BlockType.codeBlock,
		triggerPrefix: /^```([a-z]*)$/,
		markdownPrefix: "```",
		build: (config) => renderLazyBlock(LazyCodeBlock, config),
	},
	{
		type: BlockType.mathBlock,
		triggerPrefix: /^\$\$/,
		markdownPrefix: "$$",
		build: (config) => renderLazyBlock(LazyMathBlock, config),
	},
	{
		type: BlockType.image,
		markdownPrefix: "![](",
		build: (config) => renderLazyBlock(LazyImageBlock, config),
	},
	{
		type: BlockType.video,
		markdownPrefix: "![video](",
		build: (config) => renderLazyBlock(LazyVideoBlock, config),
	},
]);
