"use dom";

import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Node as TiptapNode } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React, { useEffect, useMemo, useRef } from "react";

interface Command {
	type: string;
	payload?: Record<string, unknown>;
	timestamp: number;
}

interface TiptapDomEditorProps {
	markdown: string;
	themeMode: "light" | "dark";
	command?: Command;
	onMarkdownChange?: (markdown: string) => Promise<void>;
	dom?: import("expo/dom").DOMProps;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function inlineMarkdownToHtml(value: string): string {
	return escapeHtml(value)
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/\*([^*]+)\*/g, "<em>$1</em>")
		.replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeAttribute(value: string): string {
	return escapeHtml(value).replace(/'/g, "&#39;");
}

function unescapeTableCell(value: string): string {
	return value.trim().replace(/\\\|/g, "|");
}

function splitTableRow(line: string): string[] {
	const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
	const cells: string[] = [];
	let cell = "";
	let escaping = false;
	for (const char of trimmed) {
		if (escaping) {
			cell += char;
			escaping = false;
		} else if (char === "\\") {
			cell += char;
			escaping = true;
		} else if (char === "|") {
			cells.push(unescapeTableCell(cell));
			cell = "";
		} else {
			cell += char;
		}
	}
	cells.push(unescapeTableCell(cell));
	return cells;
}

function isTableSeparator(line: string): boolean {
	return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function tableLinesToHtml(lines: string[]): string {
	const rows = lines.filter((_, index) => index !== 1).map(splitTableRow);
	const body = rows
		.map(
			(row, rowIndex) =>
				`<tr>${row
					.map((cell) => {
						const tag = rowIndex === 0 ? "th" : "td";
						return `<${tag}>${inlineMarkdownToHtml(cell)}</${tag}>`;
					})
					.join("")}</tr>`,
		)
		.join("");
	return `<table data-keeper-table="true"><tbody>${body}</tbody></table>`;
}

function markdownToHtml(markdown: string): string {
	const lines = markdown.split("\n");
	const html: string[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];

		if (line.startsWith("$$")) {
			const mathLines: string[] = [];
			index += 1;
			while (index < lines.length && !lines[index].startsWith("$$")) {
				mathLines.push(lines[index]);
				index += 1;
			}
			html.push(
				`<div data-keeper-math="true">${escapeHtml(mathLines.join("\n"))}</div>`,
			);
			continue;
		}

		if (line.startsWith("```")) {
			const language = line.slice(3).trim();
			const codeLines: string[] = [];
			index += 1;
			while (index < lines.length && !lines[index].startsWith("```")) {
				codeLines.push(lines[index]);
				index += 1;
			}
			const className = language ? ` class="language-${escapeHtml(language)}"` : "";
			html.push(`<pre><code${className}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
			continue;
		}

		if (line.trim().startsWith("<details")) {
			const detailLines = [line];
			while (index + 1 < lines.length && !lines[index].trim().startsWith("</details>")) {
				index += 1;
				detailLines.push(lines[index]);
			}
			const detailMarkdown = detailLines.join("\n");
			const summary = detailMarkdown.match(/<summary>(.*?)<\/summary>/s)?.[1] ?? "";
			const content = detailMarkdown
				.replace(/<details[^>]*>/, "")
				.replace(/<summary>.*?<\/summary>/s, "")
				.replace(/<\/details>/, "")
				.trim();
			const open = /<details\s+[^>]*open/.test(detailMarkdown) ? " data-open=\"true\"" : "";
			html.push(
				`<details${open}><summary>${inlineMarkdownToHtml(summary)}</summary><p>${inlineMarkdownToHtml(content)}</p></details>`,
			);
			continue;
		}

		if (
			line.includes("|") &&
			index + 1 < lines.length &&
			isTableSeparator(lines[index + 1])
		) {
			const tableLines = [line, lines[index + 1]];
			index += 2;
			while (index < lines.length && lines[index].includes("|") && lines[index].trim() !== "") {
				tableLines.push(lines[index]);
				index += 1;
			}
			index -= 1;
			html.push(tableLinesToHtml(tableLines));
			continue;
		}

		const image = line.match(/^!\[[^\]]*\]\(([^)]+)\)$/);
		if (image) {
			html.push(`<img src="${escapeAttribute(image[1])}" alt="" />`);
			continue;
		}

		const heading = line.match(/^(#{1,3})\s+(.*)$/);
		if (heading) {
			html.push(
				`<h${heading[1].length}>${inlineMarkdownToHtml(heading[2])}</h${heading[1].length}>`,
			);
			continue;
		}

		const task = line.match(/^\s*- \[([ xX])\]\s+(.*)$/);
		if (task) {
			const checked = task[1].toLowerCase() === "x" ? " data-checked=\"true\"" : "";
			html.push(`<ul data-type="taskList"><li data-type="taskItem"${checked}><p>${inlineMarkdownToHtml(task[2])}</p></li></ul>`);
			continue;
		}

		const bullet = line.match(/^\s*[-*]\s+(.*)$/);
		if (bullet) {
			html.push(`<ul><li><p>${inlineMarkdownToHtml(bullet[1])}</p></li></ul>`);
			continue;
		}

		const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
		if (ordered) {
			html.push(`<ol><li><p>${inlineMarkdownToHtml(ordered[1])}</p></li></ol>`);
			continue;
		}

		if (line.trim() === "") {
			html.push("<p></p>");
			continue;
		}

		html.push(`<p>${inlineMarkdownToHtml(line)}</p>`);
	}

	return html.join("");
}

function textWithInlineMarkdown(element: Element): string {
	let markdown = "";
	for (const node of Array.from(element.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			markdown += node.textContent ?? "";
			continue;
		}
		if (!(node instanceof Element)) continue;
		const text = textWithInlineMarkdown(node);
		if (node.tagName === "STRONG" || node.tagName === "B") {
			markdown += `**${text}**`;
		} else if (node.tagName === "EM" || node.tagName === "I") {
			markdown += `*${text}*`;
		} else if (node.tagName === "CODE") {
			markdown += `\`${text}\``;
		} else {
			markdown += text;
		}
	}
	return markdown;
}

function htmlToMarkdown(html: string): string {
	const parser = new DOMParser();
	const document = parser.parseFromString(`<main>${html}</main>`, "text/html");
	const blocks: string[] = [];

	for (const node of Array.from(document.body.firstElementChild?.children ?? [])) {
		if (!(node instanceof Element)) continue;
		switch (node.tagName) {
			case "IMG":
				blocks.push(`![](${node.getAttribute("src") ?? ""})`);
				break;
			case "DIV":
				if (node.getAttribute("data-keeper-math") === "true") {
					blocks.push(`$$\n${node.textContent ?? ""}\n$$`);
				} else {
					blocks.push(textWithInlineMarkdown(node));
				}
				break;
			case "DETAILS": {
				const summary = node.querySelector("summary");
				const body = Array.from(node.childNodes)
					.filter((child) => child !== summary)
					.map((child) => child.textContent ?? "")
					.join("\n")
					.trim();
				const open = node.getAttribute("data-open") === "true" || node.hasAttribute("open");
				blocks.push(
					`<details${open ? " open" : ""}>\n<summary>${summary?.textContent ?? ""}</summary>\n\n${body}\n\n</details>`,
				);
				break;
			}
			case "TABLE": {
				const rows = Array.from(node.querySelectorAll("tr")).map((row) =>
					Array.from(row.children).map((cell) =>
						(cell.textContent ?? "").replace(/\|/g, "\\|"),
					),
				);
				if (rows.length > 0 && rows[0].length > 0) {
					const width = rows[0].length;
					blocks.push(
						[
							`| ${rows[0].join(" | ")} |`,
							`| ${Array(width).fill("---").join(" | ")} |`,
							...rows.slice(1).map((row) => `| ${row.join(" | ")} |`),
						].join("\n"),
					);
				}
				break;
			}
			case "H1":
				blocks.push(`# ${textWithInlineMarkdown(node)}`);
				break;
			case "H2":
				blocks.push(`## ${textWithInlineMarkdown(node)}`);
				break;
			case "H3":
				blocks.push(`### ${textWithInlineMarkdown(node)}`);
				break;
			case "PRE":
				blocks.push(`\`\`\`\n${node.textContent ?? ""}\n\`\`\``);
				break;
			case "UL":
			case "OL": {
				const isTaskList = node.getAttribute("data-type") === "taskList";
				for (const [itemIndex, item] of Array.from(node.children).entries()) {
					if (!(item instanceof Element)) continue;
					const content = textWithInlineMarkdown(item);
					if (isTaskList) {
						const checked = item.getAttribute("data-checked") === "true";
						blocks.push(`${checked ? "- [x]" : "- [ ]"} ${content}`);
					} else if (node.tagName === "OL") {
						blocks.push(`${itemIndex + 1}. ${content}`);
					} else {
						blocks.push(`- ${content}`);
					}
				}
				break;
			}
			default:
				blocks.push(textWithInlineMarkdown(node));
		}
	}

	return blocks.join("\n").trimEnd();
}

function insertedBlockToHtml(block: unknown): string | null {
	if (!block || typeof block !== "object") return null;
	const candidate = block as {
		type?: string;
		content?: string;
		attributes?: Record<string, unknown>;
	};
	switch (candidate.type) {
		case "image":
			return `<img src="${escapeAttribute(candidate.content ?? "")}" alt="" />`;
		case "mathBlock":
			return `<div data-keeper-math="true">${escapeHtml(candidate.content ?? "")}</div>`;
		case "collapsibleBlock": {
			const summary =
				typeof candidate.attributes?.summary === "string"
					? candidate.attributes.summary
					: "";
			const open = candidate.attributes?.isExpanded !== false;
			return `<details${open ? " open data-open=\"true\"" : ""}><summary>${escapeHtml(summary)}</summary><p>${escapeHtml(candidate.content ?? "")}</p></details>`;
		}
		case "table": {
			const rows = Array.isArray(candidate.attributes?.tableData)
				? (candidate.attributes.tableData as string[][])
				: [[""]];
			const normalizedRows = rows.length > 0 ? rows : [[""]];
			return `<table data-keeper-table="true"><tbody>${normalizedRows
				.map(
					(row, rowIndex) =>
						`<tr>${row
							.map((cell) => {
								const tag = rowIndex === 0 ? "th" : "td";
								return `<${tag}>${escapeHtml(String(cell))}</${tag}>`;
							})
							.join("")}</tr>`,
				)
				.join("")}</tbody></table>`;
		}
		default:
			return null;
	}
}

const KeeperMathBlock = TiptapNode.create({
	name: "keeperMathBlock",
	group: "block",
	atom: true,
	code: true,
	addAttributes() {
		return {
			content: {
				default: "",
				parseHTML: (element) => element.textContent ?? "",
			},
		};
	},
	parseHTML: () => [{ tag: "div[data-keeper-math]" }],
	renderHTML: ({ node, HTMLAttributes }) => [
		"div",
		{ ...HTMLAttributes, "data-keeper-math": "true" },
		node.attrs.content,
	],
});

const KeeperDetailsBlock = TiptapNode.create({
	name: "keeperDetailsBlock",
	group: "block",
	atom: true,
	addAttributes() {
		return {
			summary: {
				default: "",
				parseHTML: (element) => element.querySelector("summary")?.textContent ?? "",
			},
			content: {
				default: "",
				parseHTML: (element) => {
					const summary = element.querySelector("summary");
					return Array.from(element.childNodes)
						.filter((child) => child !== summary)
						.map((child) => child.textContent ?? "")
						.join("\n")
						.trim();
				},
			},
			open: {
				default: true,
				parseHTML: (element) =>
					element.hasAttribute("open") ||
					element.getAttribute("data-open") === "true",
			},
		};
	},
	parseHTML: () => [{ tag: "details" }],
	renderHTML: ({ node, HTMLAttributes }) => [
		"details",
		{
			...HTMLAttributes,
			"data-open": node.attrs.open ? "true" : null,
			open: node.attrs.open ? "" : null,
		},
		["summary", node.attrs.summary],
		["p", node.attrs.content],
	],
});

const KeeperImageBlock = TiptapNode.create({
	name: "keeperImageBlock",
	group: "block",
	atom: true,
	addAttributes() {
		return {
			src: { default: "" },
			alt: { default: "" },
		};
	},
	parseHTML: () => [{ tag: "img[src]" }],
	renderHTML: ({ HTMLAttributes }) => ["img", HTMLAttributes],
});

const KeeperTableBlock = TiptapNode.create({
	name: "keeperTableBlock",
	group: "block",
	atom: true,
	addAttributes() {
		return {
			rows: {
				default: [[""]],
				parseHTML: (element) =>
					Array.from(element.querySelectorAll("tr")).map((row) =>
						Array.from(row.children).map((cell) => cell.textContent ?? ""),
					),
			},
		};
	},
	parseHTML: () => [{ tag: "table" }],
	renderHTML: ({ node, HTMLAttributes }) => [
		"table",
		{ ...HTMLAttributes, "data-keeper-table": "true" },
		[
			"tbody",
			...((node.attrs.rows as string[][]) ?? [[""]]).map((row, rowIndex) => [
				"tr",
				...row.map((cell) => [rowIndex === 0 ? "th" : "td", cell]),
			]),
		],
	],
});

export default function TiptapDomEditor({
	markdown,
	themeMode,
	command,
	onMarkdownChange,
}: TiptapDomEditorProps) {
	const lastAppliedMarkdownRef = useRef(markdown);
	const lastCommandTimestampRef = useRef<number | null>(null);
	const content = useMemo(() => markdownToHtml(markdown), [markdown]);

	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: { levels: [1, 2, 3] },
			}),
			TaskList,
			TaskItem.configure({ nested: true }),
			KeeperMathBlock,
			KeeperDetailsBlock,
			KeeperImageBlock,
			KeeperTableBlock,
			Placeholder.configure({ placeholder: "Write..." }),
		],
		content,
		editorProps: {
			attributes: {
				class: "keeper-tiptap-editor",
			},
		},
		onUpdate: ({ editor: activeEditor }) => {
			const nextMarkdown = htmlToMarkdown(activeEditor.getHTML());
			lastAppliedMarkdownRef.current = nextMarkdown;
			void onMarkdownChange?.(nextMarkdown);
		},
	});

	useEffect(() => {
		if (!editor || markdown === lastAppliedMarkdownRef.current) return;
		lastAppliedMarkdownRef.current = markdown;
		editor.commands.setContent(markdownToHtml(markdown), { emitUpdate: false });
	}, [editor, markdown]);

	useEffect(() => {
		if (!editor || !command || command.timestamp === lastCommandTimestampRef.current) {
			return;
		}
		lastCommandTimestampRef.current = command.timestamp;

		switch (command.type) {
			case "undo":
				editor.chain().focus().undo().run();
				break;
			case "redo":
				editor.chain().focus().redo().run();
				break;
			case "updateType": {
				const type = command.payload?.type;
				if (type === "heading1") editor.chain().focus().toggleHeading({ level: 1 }).run();
				else if (type === "heading2") editor.chain().focus().toggleHeading({ level: 2 }).run();
				else if (type === "heading3") editor.chain().focus().toggleHeading({ level: 3 }).run();
				else if (type === "bulletList") editor.chain().focus().toggleBulletList().run();
				else if (type === "numberedList") editor.chain().focus().toggleOrderedList().run();
				else if (type === "checkboxList") editor.chain().focus().toggleTaskList().run();
				else if (type === "codeBlock") editor.chain().focus().toggleCodeBlock().run();
				else if (type === "mathBlock") {
					editor.chain().focus().insertContent("<div data-keeper-math=\"true\"></div>").run();
				} else if (type === "collapsibleBlock") {
					editor
						.chain()
						.focus()
						.insertContent("<details open data-open=\"true\"><summary></summary><p></p></details>")
						.run();
				} else if (type === "table") {
					editor
						.chain()
						.focus()
						.insertContent(
							"<table data-keeper-table=\"true\"><tbody><tr><th></th><th></th></tr><tr><td></td><td></td></tr></tbody></table>",
						)
						.run();
				}
				else editor.chain().focus().setParagraph().run();
				break;
			}
			case "insertBlock": {
				const html = insertedBlockToHtml(command.payload?.block);
				if (html) {
					editor.chain().focus().insertContent(html).run();
				} else {
					editor.chain().focus().createParagraphNear().run();
				}
				break;
			}
			case "loadMarkdown":
				if (typeof command.payload?.markdown === "string") {
					lastAppliedMarkdownRef.current = command.payload.markdown;
					editor.commands.setContent(markdownToHtml(command.payload.markdown), {
						emitUpdate: false,
					});
				}
				break;
		}
	}, [command, editor]);

	return (
		<>
			<style>{`
				html, body, #root { height: 100%; margin: 0; }
				body {
					background: ${themeMode === "dark" ? "#111827" : "#ffffff"};
					color: ${themeMode === "dark" ? "#f9fafb" : "#111827"};
					font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
				}
				.keeper-tiptap-editor {
					box-sizing: border-box;
					min-height: 100vh;
					padding: 16px;
					font-size: 16px;
					line-height: 1.55;
					outline: none;
				}
				.keeper-tiptap-editor p { margin: 0 0 10px; }
				.keeper-tiptap-editor h1, .keeper-tiptap-editor h2, .keeper-tiptap-editor h3 {
					margin: 18px 0 10px;
					font-weight: 700;
					line-height: 1.2;
				}
				.keeper-tiptap-editor h1 { font-size: 28px; }
				.keeper-tiptap-editor h2 { font-size: 23px; }
				.keeper-tiptap-editor h3 { font-size: 19px; }
				.keeper-tiptap-editor ul, .keeper-tiptap-editor ol { padding-left: 24px; }
				.keeper-tiptap-editor pre {
					background: ${themeMode === "dark" ? "#1f2937" : "#f3f4f6"};
					border-radius: 6px;
					overflow: auto;
					padding: 12px;
				}
				.keeper-tiptap-editor code {
					background: ${themeMode === "dark" ? "#374151" : "#e5e7eb"};
					border-radius: 4px;
					padding: 1px 4px;
				}
				.keeper-tiptap-editor pre code { background: transparent; padding: 0; }
				.keeper-tiptap-editor img {
					display: block;
					max-width: 100%;
					border-radius: 6px;
					margin: 10px 0;
				}
				.keeper-tiptap-editor [data-keeper-math="true"] {
					background: ${themeMode === "dark" ? "#172033" : "#f8fafc"};
					border: 1px solid ${themeMode === "dark" ? "#374151" : "#d1d5db"};
					border-radius: 6px;
					font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
					margin: 10px 0;
					padding: 10px 12px;
					white-space: pre-wrap;
				}
				.keeper-tiptap-editor details {
					border: 1px solid ${themeMode === "dark" ? "#374151" : "#d1d5db"};
					border-radius: 6px;
					margin: 10px 0;
					padding: 10px 12px;
				}
				.keeper-tiptap-editor summary {
					cursor: pointer;
					font-weight: 600;
				}
				.keeper-tiptap-editor table {
					border-collapse: collapse;
					margin: 10px 0;
					width: 100%;
				}
				.keeper-tiptap-editor th, .keeper-tiptap-editor td {
					border: 1px solid ${themeMode === "dark" ? "#374151" : "#d1d5db"};
					padding: 6px 8px;
					text-align: left;
				}
				.keeper-tiptap-editor ul[data-type="taskList"] {
					list-style: none;
					padding-left: 0;
				}
				.keeper-tiptap-editor li[data-type="taskItem"] {
					align-items: flex-start;
					display: flex;
					gap: 8px;
				}
				.keeper-tiptap-editor li[data-type="taskItem"] > label { margin-top: 2px; }
				.keeper-tiptap-editor .is-editor-empty:first-child::before {
					color: ${themeMode === "dark" ? "#9ca3af" : "#6b7280"};
					content: attr(data-placeholder);
					float: left;
					height: 0;
					pointer-events: none;
				}
			`}</style>
			<EditorContent editor={editor} />
		</>
	);
}
