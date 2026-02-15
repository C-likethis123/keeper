export interface Note {
  title: string;
  content: string;
  filePath: string;
  lastUpdated: number;
  isPinned?: boolean;
}

export interface NoteToSave extends Omit<Note, 'lastUpdated' | 'filePath'> {
  lastUpdated?: number;
  filePath?: string;
}
