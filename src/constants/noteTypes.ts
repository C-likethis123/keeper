import type { NoteStatus, NoteType } from "@/services/notes/types";

type FilterOption<T extends string> = {
  label: string;
  value?: T;
};

export const TODO_STATUS_OPTIONS: FilterOption<NoteStatus>[] = [
  { label: "Open", value: "open" },
  { label: "Doing", value: "doing" },
  { label: "Blocked", value: "blocked" },
  { label: "Done", value: "done" },
];
