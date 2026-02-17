import { Directory, File } from 'expo-file-system';
import { NOTES_ROOT } from './Notes';

function getExtension(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

function uniqueId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function copyPickedImageToNotes(uri: string): Promise<string> {
  const ext = getExtension(uri);
  const filename = `${uniqueId()}${ext}`;
  const assetsDir = new Directory(NOTES_ROOT, 'assets');
  if (!assetsDir.exists) {
    assetsDir.create({ intermediates: true });
  }
  const source = new File(uri);
  const dest = new File(assetsDir, filename);
  source.copy(dest);
  return `assets/${filename}`;
}
