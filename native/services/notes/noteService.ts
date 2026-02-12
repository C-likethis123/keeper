import { File, Directory } from "expo-file-system";
import { Note, NoteToSave } from "./types";
import {
  NotesIndexService,
  extractSummary,
} from "@/services/notes/notesIndex";
import { NOTES_ROOT } from "./Notes";
import { GitService } from "@/services/git/gitService";
import { getFile } from "@/services/git/gitApi";
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
      // Check if path is relative (doesn't start with / or file://)
      const isRelative = !filePath.startsWith('/') && !filePath.startsWith('file://');
      
      if (isRelative) {
        // For relative paths, try local repository first, then fall back to git API
        const localFilePath = `${NOTES_ROOT}${filePath}`;
        
        try {
          const file = new File(localFilePath);
          if (file.exists) {
            const content = await file.text();
            const fileName = filePath.split("/").pop() || "Untitled";
            const indexItem = await NotesIndexService.instance.getNote(filePath);
            const lastUpdated = indexItem?.updatedAt || (file.modificationTime ? file.modificationTime * 1000 : Date.now());
            
            return {
              title: fileName.replace(/\.md$/, ""),
              content,
              filePath,
              lastUpdated,
            };
          }
        } catch (localError) {
          // File doesn't exist locally, fall back to git API
        }
        
        // Fall back to git API if local file doesn't exist
        const result = await getFile(filePath);
        if (!result.success || !result.content) {
          console.warn("Failed to load note from git:", result.error);
          return null;
        }
        
        const fileName = filePath.split("/").pop() || "Untitled";
        const indexItem = await NotesIndexService.instance.getNote(filePath);
        const lastUpdated = indexItem?.updatedAt || Date.now();
        
        return {
          title: fileName.replace(/\.md$/, ""),
          content: result.content,
          filePath,
          lastUpdated,
        };
      }
      
      // For absolute paths, use local filesystem
      const file = new File(filePath);
      if (!file.exists) return null;

      const content = await file.text();
      const fileName = filePath.split("/").pop() || "Untitled";
      const lastUpdated = file.modificationTime ? file.modificationTime * 1000 : Date.now();

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
    let filePath =
      note.filePath ||
      (await this.resolveFilePath(NOTES_ROOT, note.title, undefined));
    
    // Check if path is relative (doesn't start with / or file://)
    const isRelative = !filePath.startsWith('/') && !filePath.startsWith('file://');
    
    // Store original relative path for git operations
    const relativePath = isRelative ? filePath : undefined;
    
    // Convert relative paths to absolute paths for FileSystem operations
    if (isRelative) {
      filePath = `${NOTES_ROOT}${filePath}`;
    }
    
    // Ensure directory exists for the absolute path
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
    
    // Get existing note from DynamoDB to preserve createdAt if it exists
    const existingIndexItem = await NotesIndexService.instance.getNote(indexPath);
    const createdAt = existingIndexItem?.createdAt ?? (note.lastUpdated ?? lastUpdated);

    const summary = extractSummary(note.content);
    await NotesIndexService.instance.upsertNote({
      noteId: indexPath,
      summary,
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
      const file = new File(filePath);
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
    // This method is kept for backward compatibility but is no longer used
    // since we now fetch notes from DynamoDB index.
    // If needed, it can fetch pinned state from DynamoDB for each file.
    const metadata: Note[] = [];
    try {
      const dir = new Directory(folderPath);
      const entries = dir.list();

      for (const entry of entries) {
        if (entry instanceof File && entry.name.endsWith('.md')) {
          // Try to get pinned state from DynamoDB index
          const indexItem = await NotesIndexService.instance.getNote(entry.uri);
          const content = await entry.text();
          metadata.push({
            filePath: entry.uri,
            title: entry.name.replace(/\.md$/, ''),
            content,
            lastUpdated: entry.modificationTime ? entry.modificationTime * 1000 : Date.now(),
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

