/** Document panel receives position updates through its browser callback. */
// biome-ignore lint/complexity/noStaticOnlyClass: Canonical panel imports static NoteService API.
export class NoteService {
	static async loadNote(_noteId: string) { return null; }
	static async saveNote<T>(note: T) { return note; }
}
