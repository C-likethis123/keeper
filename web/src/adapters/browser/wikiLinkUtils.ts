import { NotesIndexService, type NoteIndexItem } from "@web/adapters/browser/notesIndex";

export function findExactWikiLinkMatch(items: NoteIndexItem[], title: string) { const query = title.trim().toLocaleLowerCase(); return items.find((item) => item.title.trim().toLocaleLowerCase() === query) ?? null; }
export async function resolveOrCreateWikiLinkNoteId(title: string) { const result = await NotesIndexService.listNotes(title, 1); return findExactWikiLinkMatch(result.items, title)?.noteId ?? null; }
export function shouldOpenWikiLink(platform: string, event?: { metaKey?: boolean; ctrlKey?: boolean; nativeEvent?: { metaKey?: boolean; ctrlKey?: boolean } }) { return platform !== "web" || Boolean(event?.metaKey || event?.ctrlKey || event?.nativeEvent?.metaKey || event?.nativeEvent?.ctrlKey); }
