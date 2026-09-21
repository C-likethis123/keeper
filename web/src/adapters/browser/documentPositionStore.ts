const keyFor = (noteId: string, path: string) => `keeper:document-position:${noteId}:${path}`;
export async function loadDocumentPosition(noteId: string, path: string) { return localStorage.getItem(keyFor(noteId, path)); }
export async function saveDocumentPosition(noteId: string, path: string, position: string) { localStorage.setItem(keyFor(noteId, path), position); }
