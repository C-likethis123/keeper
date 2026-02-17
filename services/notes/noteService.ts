import { GitService } from "@/services/git/gitService";
import {
  NotesIndexService,
  extractSummary,
} from "@/services/notes/notesIndex";
import { NotesMetaService } from "@/services/notes/notesMetaService";
import { Directory, File } from "expo-file-system";
import { normalizePath } from "@/services/git/expoFileSystemAdapter";
import { NOTES_ROOT } from "./Notes";
import { toAbsoluteNotesPath } from "./notesPaths";
import { Note, NoteToSave } from "./types";

function sanitizePathFilename(path: string): string {
  const i = path.lastIndexOf("/");
  if (i === -1) return path;
  const dir = path.slice(0, i);
  const file = path.slice(i + 1);
  const base = file.replace(/\.md$/i, "");
  return `${dir}/${sanitizeFileName(base)}.md`;
}

function sanitizeFileName(title: string) {
  return title
    .trim()
    .replace(/[<>:"/\\|?*\[\]]+/g, "_")
    .slice(0, 100);
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

  static async loadNote(filePath: string): Promise<Note | null> {
    try {
      const absolutePath = toAbsoluteNotesPath(filePath);
      const file = new File(absolutePath);
      if (file.exists) {
        const content = await file.text();
        const mtime = file.modificationTime ?? 0;
        const isPinned = await NotesMetaService.getPinned(filePath);
        const fileName = filePath.split("/").pop() || "Untitled";
        return {
          title: decodeURIComponent(fileName.replace(/\.md$/, "")),
          content,
          filePath,
          lastUpdated: mtime,
          isPinned,
        };
      }
    } catch (localError) {
      console.warn("Failed to load note:", localError);
      return null;
    }
    return null;
  }

  static async saveNote(note: NoteToSave): Promise<Note> {
    const isNew = !note.filePath;
    let filePath =
      note.filePath ||
      (await this.resolveFilePath(NOTES_ROOT, note.title, undefined));

    filePath = sanitizePathFilename(filePath);

    const isRelative = !filePath.startsWith('/') && !filePath.startsWith('file://');
    const relativePath = isRelative ? filePath : undefined;
    if (isRelative) {
      filePath = toAbsoluteNotesPath(filePath);
    } else {
      filePath = normalizePath(filePath);
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
    const indexPath = relativePath || filePath;
    const createdAt = note.lastUpdated ?? lastUpdated;

    const summary = extractSummary(note.content);
    await NotesIndexService.upsertNote({
      noteId: indexPath,
      summary,
      title: note.title,
      isPinned: pinnedState,
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

  static async deleteNote(filePath: string): Promise<boolean> {
    try {
      const absolutePath = toAbsoluteNotesPath(filePath);
      const file = new File(absolutePath);
      if (!file.exists) return false;

      file.delete();
      try {
        await NotesIndexService.deleteNote(filePath);
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

  static async scanNotes(folderPath: string): Promise<Note[]> {
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
            isPinned: indexItem?.isPinned ?? false,
          });
        }
      }
    } catch (e) {
      console.warn("Failed to scan notes:", e);
    }
    return metadata;
  }



  static async resolveFilePath(
    folderPath: string,
    title: string,
    existingPath?: string
  ): Promise<string> {
    if (existingPath) {
      return existingPath;
    }

    const baseName = sanitizeFileName(title || "Untitled");
    let candidate = `${folderPath}/${baseName}.md`;
    let counter = 1;

    while (new File(candidate).exists) {
      candidate = `${folderPath}/${baseName}_${counter}.md`;
      counter++;
    }

    return candidate;
  }

}

