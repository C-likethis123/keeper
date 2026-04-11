import type { NoteStatus, NoteType } from "@/services/notes/types";

export type FilterOption<T extends string> = {
  label: string;
  value?: T;
};
export const NOTE_TYPE_OPTIONS: FilterOption<NoteType>[] = [
  { label: "All notes", value: undefined },
  { label: "Notes", value: "note" },
  { label: "Journals", value: "journal" },
  { label: "Resources", value: "resource" },
  { label: "Todos", value: "todo" },
];

export const TODO_STATUS_OPTIONS: FilterOption<NoteStatus>[] = [
  { label: "Open", value: "open" },
  { label: "Doing", value: "doing" },
  { label: "Blocked", value: "blocked" },
  { label: "Done", value: "done" },
];
