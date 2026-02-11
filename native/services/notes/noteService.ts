import { File, Directory } from "expo-file-system";
import { Note, NoteToSave } from "./types";
import {
  NotesIndexService,
  extractSummary,
} from "@/services/notes/notesIndex";
import { NOTES_ROOT } from "./Notes";
import { GitService } from "@/services/git/gitService";
export class NoteService {
  static instance = new NoteService();

  private constructor() { }

  async loadNote(filePath: string): Promise<Note | null> {
    try {
      const info = await new File(filePath);
      if (!info.exists || new Directory(filePath).exists) return null;

      const content = await new File(filePath).text();
      const fileName = filePath.split("/").pop() || "Untitled";
      const lastUpdated = info.modificationTime || Date.now();

      return {
        title: fileName.replace(/\.md$/, ""),
        content,
        filePath,
        lastUpdated,
      };
    } catch (e) {
      console.warn("Failed to load note:", e);
      return null;
    }
  }

  async saveNote(note: NoteToSave): Promise<Note> {
    const isNew = !note.filePath;
    const filePath =
      note.filePath ||
      (await this.resolveFilePath(NOTES_ROOT, note.title, undefined));

    await new File(filePath).write(note.content);

    const lastUpdated = Date.now();
    const pinnedState = !!note.isPinned;

    // Get existing note from DynamoDB to preserve createdAt if it exists
    const existingIndexItem = await NotesIndexService.instance.getNote(filePath);
    const createdAt = existingIndexItem?.createdAt ?? (note.lastUpdated ?? lastUpdated);

    const summary = extractSummary(note.content);
    await NotesIndexService.instance.upsertNote({
      noteId: filePath,
      summary,
      status: pinnedState ? "PINNED" : "UNPINNED",
      sortTimestamp: lastUpdated,
      createdAt,
      updatedAt: lastUpdated,
    });

    GitService.instance.queueChange(filePath, isNew ? "add" : "modify");

    return {
      title: note.title,
      content: note.content,
      filePath,
      lastUpdated,
      isPinned: pinnedState,
    };
  }

  async deleteNote(filePath: string): Promise<boolean> {
    try {
      const info = await new File(filePath).info();
      if (!info.exists) return false;

      await new File(filePath).delete();
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
    // This method is kept for backward compatibility but is no longer used
    // since we now fetch notes from DynamoDB index.
    // If needed, it can fetch pinned state from DynamoDB for each file.
    const metadata: Note[] = [];
    try {
      const entries = await new Directory(folderPath).list();

      for (const file of entries) {
        if (file instanceof File && file.extension === ".md") {
          // Try to get pinned state from DynamoDB index
          const indexItem = await NotesIndexService.instance.getNote(file.uri);
          metadata.push({
            filePath: file.uri,
            title: file.name,
            content: await file.text(),
            lastUpdated: file.modificationTime || Date.now(),
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

    while ((await new File(candidate).info()).exists) {
      candidate = `${folderPath}/${baseName}_${counter}.md`;
      counter++;
    }

    return candidate;
  }

}

