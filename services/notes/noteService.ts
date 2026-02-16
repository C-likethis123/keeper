import { normalizePath } from "@/services/git/expoFileSystemAdapter";
import { GitService } from "@/services/git/gitService";
import {
  NotesIndexService,
  extractSummary,
} from "@/services/notes/notesIndex";
import { Directory, File } from "expo-file-system";
import { NOTES_ROOT } from "./Notes";
import { Note, NoteToSave } from "./types";

function toAbsolutePath(filePath: string): string {
  const isRelative = !filePath.startsWith("/") && !filePath.startsWith("file://");
  if (!isRelative) return filePath;
  const root = NOTES_ROOT.endsWith("/") ? NOTES_ROOT.slice(0, -1) : NOTES_ROOT;
  const raw = root + "/" + filePath;
  return NOTES_ROOT.startsWith("file:") ? normalizePath(raw) : raw;
}

export class NoteService {
  static instance = new NoteService();

  private constructor() {
    // Ensure NOTES_ROOT exists on initialization
    this.ensureNotesRoot();
  }

  private async ensureNotesRoot(): Promise<void> {
    try {
      const dir = new Directory(NOTES_ROOT);
      if (!dir.exists) {
        dir.create({ intermediates: true });
      }
    } catch (e) {
      console.warn('Failed to ensure notes root:', e);
    }
  }

  async loadNote(filePath: string): Promise<Note | null> {
    try {
      const absolutePath = toAbsolutePath(filePath);
      const file = new File(absolutePath);
      if (file.exists) {
        const content = await file.text();
        const fileName = filePath.split("/").pop() || "Untitled";
        const indexItem = await NotesIndexService.instance.getNote(filePath);
        const lastUpdated = indexItem!.updatedAt!;

        return {
          title: decodeURIComponent(fileName.replace(/\.md$/, "")),
          content,
          filePath,
          lastUpdated,
          isPinned: indexItem?.status === "PINNED",
        };
      }
    } catch (localError) {
      console.warn("Failed to load note:", localError);
      return null;
    }
    return null;
  }

  async saveNote(note: NoteToSave): Promise<Note> {
    const isNew = !note.filePath;
    let filePath =
      note.filePath ||
      (await this.resolveFilePath(NOTES_ROOT, note.title, undefined));

    const isRelative = !filePath.startsWith('/') && !filePath.startsWith('file://');
    const relativePath = isRelative ? filePath : undefined;
    if (isRelative) {
      filePath = `${NOTES_ROOT}${filePath}`;
    }

    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
    const dir = new Directory(dirPath);
    if (!dir.exists) {
      dir.create({ intermediates: true });
    }

    // Save to absolute path
    const file = new File(filePath);
    await file.write(note.content);

    const lastUpdated = Date.now();
    const pinnedState = !!note.isPinned;

    // Use relative path for index and git operations, absolute path for return
    const indexPath = relativePath || filePath;

    const existingIndexItem = await NotesIndexService.instance.getNote(indexPath);
    const createdAt = existingIndexItem?.createdAt ?? (note.lastUpdated ?? lastUpdated);

    const summary = extractSummary(note.content);
    await NotesIndexService.instance.upsertNote({
      noteId: indexPath,
      summary,
      title: note.title,
      status: pinnedState ? "PINNED" : "UNPINNED",
      sortTimestamp: lastUpdated,
      createdAt,
      updatedAt: lastUpdated,
    });

    GitService.instance.queueChange(indexPath, isNew ? "add" : "modify");

    return {
      title: note.title,
      content: note.content,
      filePath: indexPath, // Return relative path for consistency
      lastUpdated,
      isPinned: pinnedState,
    };
  }

  async deleteNote(filePath: string): Promise<boolean> {
    try {
      const absolutePath = toAbsolutePath(filePath);
      const file = new File(absolutePath);
      if (!file.exists) return false;

      file.delete();
      try {
        await NotesIndexService.instance.deleteNote(filePath);
      } catch (err) {
        console.warn("Failed to delete note from index:", err);
      }
      GitService.instance.queueChange(filePath, "delete");
      return true;
    } catch (e) {
      console.warn("Failed to delete note:", e);
      return false;
    }
  }

  async scanNotes(folderPath: string): Promise<Note[]> {
    // Kept for backward compatibility; list comes from NotesIndexService (filesystem + metaStore).
    const metadata: Note[] = [];
    try {
      const dir = new Directory(folderPath);
      const entries = dir.list();

      for (const entry of entries) {
        if (entry instanceof File && entry.name.endsWith('.md')) {
          const indexItem = await NotesIndexService.instance.getNote(entry.uri);
          const content = await entry.text();
          metadata.push({
            filePath: entry.uri,
            title: decodeURIComponent(entry.name.replace(/\.md$/, '')),
            content,
            lastUpdated: entry.modificationTime!,
            isPinned: indexItem?.status === "PINNED" || false,
          });
        }
      }
    } catch (e) {
      console.warn("Failed to scan notes:", e);
    }
    return metadata;
  }

  private sanitizeFileName(title: string) {
    return title
      .trim()
      .replace(/[<>:"/\\|?*]+/g, "_")
      .slice(0, 100);
  }

  private async resolveFilePath(
    folderPath: string,
    title: string,
    existingPath?: string
  ): Promise<string> {
    if (existingPath) {
      return existingPath;
    }

    const baseName = this.sanitizeFileName(title || "Untitled");
    let candidate = `${folderPath}/${baseName}.md`;
    let counter = 1;

    while (new File(candidate).exists) {
      candidate = `${folderPath}/${baseName}_${counter}.md`;
      counter++;
    }

    return candidate;
  }

}

