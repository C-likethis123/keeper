import { File, Directory } from "expo-file-system";
import { Note, NoteMetadata, NoteToSave } from "./types";
import { loadFolder } from "../settings/storage";

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
        const folderPath = await loadFolder();
        const filePath = await this.resolveFilePath(
          folderPath!,
          note.title,
          note.filePath
        );
      
        await new File(filePath).write(note.content);
      
        return {
          title: note.title,
          content: note.content,
          filePath,
          lastUpdated: Date.now(),
          isPinned: note.isPinned,
        };
      }

    async deleteNote(filePath: string): Promise<boolean> {
        try {
            const info = await new File(filePath).info();
            if (!info.exists) return false;

            await new File(filePath).delete();
            return true;
        } catch (e) {
            console.warn("Failed to delete note:", e);
            return false;
        }
    }

    async scanNotes(folderPath: string): Promise<NoteMetadata[]> {
        const metadata: NoteMetadata[] = [];
        try {
            const entries = await new Directory(folderPath).list();

            for (const name of entries) {
                const fullPath = `${folderPath}${name}`;
                const file = await new File(fullPath);
                if (file.exists && file.extension === "md") {
                    metadata.push({
                        filePath: fullPath,
                        title: file.name,
                        lastModified: file.modificationTime || Date.now(),
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

