import type { NoteType } from "./types";

const RESOURCE_PREFIXES = [
  "resource",
  "book:",
  "article:",
  "paper:",
  "reddit:",
  "video:",
  "podcast:",
  "link:",
  "ref:",
  "source:",
];

const JOURNAL_DATE_PATTERN =
  /(?:^|\n)\s*(?:#\s*)?(?:\d{4}-\d{2}-\d{2}|[A-Z][a-z]+ \d{1,2}, \d{4})\b/m;

// It does not just derive from title, it also derives it from the content.
export function deriveNoteType(title: string): NoteType {
  const lower = title.trimStart().toLowerCase();

  if (lower.startsWith("journal") || JOURNAL_DATE_PATTERN.test(lower))
    return "journal";
  if (lower.startsWith("todo") || lower.startsWith("to-do")) return "todo";
  if (lower.startsWith("template")) return "template";

  if (
    RESOURCE_PREFIXES.some((prefix) => lower.startsWith(prefix)) ||
    /https?:\/\//.test(title)
  ) {
    return "resource";
  }
  return "note";
}
