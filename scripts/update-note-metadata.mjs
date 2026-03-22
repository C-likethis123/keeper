#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";

const VALID_NOTE_TYPES = new Set(["journal", "resource", "todo", "note"]);
const VALID_NOTE_STATUSES = new Set(["open", "blocked", "doing", "done"]);
const SUPPORTED_FRONTMATTER_KEYS = new Set([
	"pinned",
	"title",
	"id",
	"type",
	"status",
]);

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const root = expandHome(options.root ?? "~/Documents/logseq");
	const stats = {
		scannedFiles: 0,
		rewrittenNotes: 0,
		extractedTodos: 0,
		skippedFiles: 0,
		collisions: 0,
	};

	const rootStat = await safeStat(root);
	if (!rootStat?.isDirectory()) {
		throw new Error(`Notes root does not exist or is not a directory: ${root}`);
	}

	const markdownFiles = await collectMarkdownFiles(root);
	const existingPaths = new Set(
		markdownFiles.map((filePath) => path.resolve(filePath)),
	);
	const reservedTodoPaths = new Set();

	for (const filePath of markdownFiles) {
		stats.scannedFiles += 1;
		const result = await migrateMarkdownFile(filePath, {
			root,
			write: options.write,
			verbose: options.verbose,
			includeExistingFrontmatter: options.includeExistingFrontmatter,
			existingPaths,
			reservedTodoPaths,
		});

		stats.rewrittenNotes += result.rewrittenNotes;
		stats.extractedTodos += result.extractedTodos;
		stats.collisions += result.collisions;
		stats.skippedFiles += result.changed ? 0 : 1;
	}

	printSummary(stats, options.write, root);
}

function parseArgs(argv) {
	const options = {
		root: "~/Documents/logseq",
		write: false,
		verbose: false,
		includeExistingFrontmatter: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--write") {
			options.write = true;
			continue;
		}
		if (arg === "--verbose") {
			options.verbose = true;
			continue;
		}
		if (arg === "--include-existing-frontmatter") {
			options.includeExistingFrontmatter = true;
			continue;
		}
		if (arg === "--root") {
			const value = argv[index + 1];
			if (!value) {
				throw new Error("Missing value for --root");
			}
			options.root = value;
			index += 1;
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			printHelp();
			process.exit(0);
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	return options;
}

function printHelp() {
	console.log(`Usage: npm run migrate:note-metadata -- [options]

Options:
  --root <path>                     Root directory of the markdown notes repo
  --write                           Apply changes instead of previewing them
  --verbose                         Print per-file actions
  --include-existing-frontmatter    Preserve unsupported frontmatter lines/comments
  --help                            Show this message`);
}

function expandHome(value) {
	if (value === "~") {
		return os.homedir();
	}
	if (value.startsWith("~/")) {
		return path.join(os.homedir(), value.slice(2));
	}
	return value;
}

async function safeStat(targetPath) {
	try {
		return await fs.stat(targetPath);
	} catch {
		return null;
	}
}

async function collectMarkdownFiles(root) {
	const files = [];
	await walkDirectory(root, files);
	files.sort((left, right) => left.localeCompare(right));
	return files;
}

async function walkDirectory(currentDir, files) {
	const entries = await fs.readdir(currentDir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.name === ".git") continue;
		const nextPath = path.join(currentDir, entry.name);
		if (entry.isDirectory()) {
			await walkDirectory(nextPath, files);
			continue;
		}
		if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
			files.push(nextPath);
		}
	}
}

async function migrateMarkdownFile(filePath, options) {
	const markdown = await fs.readFile(filePath, "utf8");
	const fileName = path.basename(filePath, ".md");
	const relativePath =
		path.relative(options.root, filePath) || path.basename(filePath);
	const parsed = splitFrontmatter(markdown);
	const title = normalizeTitle(parsed.fields.title, fileName);
	const isPinned = parsed.fields.pinned ?? false;
	const noteType = getFinalNoteType(
		parsed.fields.noteType,
		title,
		fileName,
		parsed.body,
	);
	const sourceId = fileName;
	const directory = path.dirname(filePath);
	const extraction = extractTodos(parsed.body, {
		directory,
		existingPaths: options.existingPaths,
		reservedTodoPaths: options.reservedTodoPaths,
	});

	const nextMarkdown = stringifyFrontmatter({
		id: sourceId,
		title,
		isPinned,
		noteType,
		status: noteType === "todo" ? parsed.fields.status : undefined,
		content: extraction.body,
		extraLines: options.includeExistingFrontmatter ? parsed.extraLines : [],
	});

	const sourceChanged = nextMarkdown !== markdown;
	const changed = sourceChanged || extraction.todos.length > 0;

	if (options.verbose) {
		logFileAction(relativePath, noteType, sourceChanged, extraction);
	}

	if (options.write) {
		if (sourceChanged) {
			await fs.writeFile(filePath, nextMarkdown, "utf8");
		}
		for (const todo of extraction.todos) {
			await fs.writeFile(todo.filePath, todo.markdown, "utf8");
		}
	}

	return {
		changed,
		rewrittenNotes: sourceChanged ? 1 : 0,
		extractedTodos: extraction.todos.length,
		collisions: extraction.collisions,
	};
}

function logFileAction(relativePath, noteType, sourceChanged, extraction) {
	const tags = [
		`type=${noteType}`,
		sourceChanged ? "rewrite" : "unchanged",
		extraction.todos.length > 0 ? `todos=${extraction.todos.length}` : null,
		extraction.collisions > 0 ? `collisions=${extraction.collisions}` : null,
	].filter(Boolean);
	console.log(`${relativePath}: ${tags.join(", ")}`);
}

function splitFrontmatter(markdown) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
	if (!match) {
		return {
			fields: {},
			extraLines: [],
			body: markdown,
		};
	}

	const rawFrontmatter = match[1];
	const body = markdown.slice(match[0].length);
	const fields = {};
	const extraLines = [];

	for (const rawLine of rawFrontmatter.split(/\r?\n/)) {
		const trimmed = rawLine.trim();
		if (trimmed.length === 0 || trimmed.startsWith("#")) {
			extraLines.push(rawLine);
			continue;
		}

		const separator = rawLine.indexOf(":");
		if (separator < 0) {
			extraLines.push(rawLine);
			continue;
		}

		const key = rawLine.slice(0, separator).trim();
		const value = parseYamlScalar(rawLine.slice(separator + 1));

		if (key === "title") {
			fields.title = value;
			continue;
		}
		if (key === "pinned") {
			fields.pinned = value.toLowerCase() === "true";
			continue;
		}
		if (key === "id") {
			fields.id = value;
			continue;
		}
		if (key === "type" && VALID_NOTE_TYPES.has(value)) {
			fields.noteType = value;
			continue;
		}
		if (key === "status" && VALID_NOTE_STATUSES.has(value)) {
			fields.status = value;
			continue;
		}

		extraLines.push(rawLine);
	}

	return {
		fields,
		extraLines: extraLines.filter((line) => {
			const separator = line.indexOf(":");
			if (separator < 0) return true;
			const key = line.slice(0, separator).trim();
			return !SUPPORTED_FRONTMATTER_KEYS.has(key);
		}),
		body,
	};
}

function parseYamlScalar(raw) {
	const trimmed = raw.trim();
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		try {
			return JSON.parse(trimmed);
		} catch {
			return trimmed.slice(1, -1);
		}
	}
	if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
		return trimmed.slice(1, -1).replace(/''/g, "'");
	}
	return trimmed;
}

function stringifyYamlString(value) {
	return JSON.stringify(value);
}

function stringifyFrontmatter(note) {
	const lines = [
		"---",
		`pinned: ${note.isPinned ? "true" : "false"}`,
		`title: ${stringifyYamlString(note.title.trim())}`,
		`id: ${stringifyYamlString(note.id)}`,
		`type: ${stringifyYamlString(note.noteType)}`,
	];

	if (note.noteType === "todo" && note.status) {
		lines.push(`status: ${stringifyYamlString(note.status)}`);
	}

	for (const extraLine of note.extraLines ?? []) {
		lines.push(extraLine);
	}

	lines.push("---");
	return `${lines.join("\n")}\n${note.content}`;
}

function normalizeTitle(existingTitle, fallback) {
	const title = (existingTitle ?? "").trim();
	return title.length > 0 ? title : fallback.trim();
}

function getFinalNoteType(existingType, title, fileName, body) {
	if (VALID_NOTE_TYPES.has(existingType)) {
		return existingType;
	}
	if (isJournalNote(title, fileName)) {
		return "journal";
	}
	if (isResourceNote(title, body)) {
		return "resource";
	}
	return "note";
}

function isJournalNote(title, fileName) {
	const haystack = `${title} ${fileName}`.toLowerCase();
	if (haystack.includes("journal")) return true;
	if (/\b(weekly|yearly|annual|monthly)\s+(journal|review)\b/.test(haystack)) {
		return true;
	}
	if (/\b\d{4}[-_/]\d{1,2}[-_/]\d{1,2}\b/.test(haystack)) {
		return true;
	}
	if (/\b\d{1,2}[-_/]\d{1,2}[-_/]\d{4}\b/.test(haystack)) {
		return true;
	}
	if (/\b(?:20\d{2}|19\d{2})\b/.test(haystack) && /review\b/.test(haystack)) {
		return true;
	}
	return false;
}

function isResourceNote(title, body) {
	const titleText = title.toLowerCase();
	const bodyText = body.toLowerCase();
	const titleLooksLikeResource =
		/\b(video|source|article|reddit compilation|reddit|book|podcast|paper|essay|lecture|talk)\b/.test(
			titleText,
		);
	if (titleLooksLikeResource) {
		return true;
	}

	const hasLink = /https?:\/\/\S+/i.test(body);
	const bodyLooksLikeReference =
		/\b(video|source|article|book|podcast|paper|essay|reference|link|read|watch)\b/.test(
			bodyText,
		);
	return hasLink && bodyLooksLikeReference;
}

function extractTodos(body, options) {
	const lines = body.split(/\r?\n/);
	const todos = [];
	let collisions = 0;

	for (let index = 0; index < lines.length; index += 1) {
		const match = /^(\s*)- \[([ xX])\]\s+(.*)$/.exec(lines[index]);
		if (!match) continue;

		const indentation = match[1];
		const checked = match[2].toLowerCase() === "x";
		const rawText = match[3].trim();
		if (rawText.length === 0 || isAlreadyMigratedTodo(rawText)) {
			continue;
		}

		const title = normalizeTodoTitle(rawText);
		if (title.length === 0) {
			continue;
		}

		const candidate = reserveTodoFile({
			title,
			directory: options.directory,
			existingPaths: options.existingPaths,
			reservedTodoPaths: options.reservedTodoPaths,
		});

		collisions += candidate.collisionCount;

		const status = checked ? "done" : "open";
		const markdown = stringifyFrontmatter({
			id: candidate.id,
			title: candidate.title,
			isPinned: false,
			noteType: "todo",
			status,
			content: "",
			extraLines: [],
		});

		todos.push({
			filePath: candidate.filePath,
			markdown,
		});

		lines[index] =
			`${indentation}- [${checked ? "x" : " "}] [[${candidate.title}]]`;
	}

	return {
		body: lines.join("\n"),
		todos,
		collisions,
	};
}

function isAlreadyMigratedTodo(text) {
	return /^\[\[[^[\]]+\]\]$/.test(text);
}

function normalizeTodoTitle(rawText) {
	return rawText.replace(/\s+/g, " ").trim();
}

function reserveTodoFile({
	title,
	directory,
	existingPaths,
	reservedTodoPaths,
}) {
	let collisions = 0;

	while (true) {
		const id = nanoid();
		const filePath = path.resolve(path.join(directory, `${id}.md`));
		const taken =
			existingPaths.has(filePath) || reservedTodoPaths.has(filePath);
		if (!taken) {
			reservedTodoPaths.add(filePath);
			existingPaths.add(filePath);
			return {
				id,
				title,
				filePath,
				collisionCount: collisions,
			};
		}
		collisions += 1;
	}
}

function printSummary(stats, didWrite, root) {
	console.log("");
	console.log(didWrite ? "Migration complete." : "Dry run complete.");
	console.log(`Root: ${root}`);
	console.log(`Scanned files: ${stats.scannedFiles}`);
	console.log(`Rewritten notes: ${stats.rewrittenNotes}`);
	console.log(`Extracted todo notes: ${stats.extractedTodos}`);
	console.log(`Skipped files: ${stats.skippedFiles}`);
	console.log(`Collisions resolved: ${stats.collisions}`);
	console.log(
		didWrite
			? "Changes were written to disk."
			: "Re-run with --write to apply these changes.",
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
