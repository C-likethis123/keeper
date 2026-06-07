import { NotesIndexService, extractSummary } from "@/services/notes/notesIndex";
import { storageEngine } from "@/services/storage/storageEngine";
import { AsyncQueue } from "./asyncQueue";
import type {
	GitExitLog,
	GitJournalEntry,
	GitJournalOperation,
	GitSyncStateStore,
} from "./init/types";

export class GitJournal {
	private readonly queue = new AsyncQueue();

	constructor(private readonly stateStore: GitSyncStateStore) {}

	queueChange(
		filePath: string,
		operation: GitJournalOperation,
		note?: GitJournalEntry["note"],
	): Promise<void> {
		if (!filePath) return Promise.resolve();

		return this.queue.run(async () => {
			const journal = await this.stateStore.readPendingJournal();
			const pending = new Map(journal.map((entry) => [entry.filePath, entry]));
			const previous = pending.get(filePath);
			const updatedAt = Date.now();

			if (previous?.operation === "add" && operation === "modify") {
				pending.set(filePath, { ...previous, note, updatedAt });
			} else if (previous?.operation === "add" && operation === "delete") {
				pending.delete(filePath);
			} else if (previous?.operation === "modify" && operation === "delete") {
				pending.set(filePath, { filePath, operation: "delete", updatedAt });
			} else {
				pending.set(filePath, { filePath, operation, note, updatedAt });
			}

			await this.write([...pending.values()]);
		});
	}

	clear(): Promise<void> {
		return this.queue.run(() => this.write([]));
	}

	read(): Promise<GitJournalEntry[]> {
		return this.stateStore.readPendingJournal();
	}

	hasPending(): Promise<boolean> {
		return this.read().then((journal) => journal.length > 0);
	}

	async logExitState(reason: string, documentVersion?: number): Promise<void> {
		const journal = await this.stateStore.readPendingJournal();
		if (journal.length === 0) return;

		const exitLog: GitExitLog = {
			timestamp: Date.now(),
			reason,
			documentVersion,
		};

		await this.write(
			journal.map((entry) => ({
				...entry,
				exitLog: entry.exitLog ?? exitLog,
			})),
		);
	}

	async hasExitLog(): Promise<boolean> {
		const journal = await this.read();
		return journal.some((entry) => entry.exitLog != null);
	}

	async getLatestExitLog(): Promise<GitExitLog | null> {
		const journal = await this.read();
		let latest: GitExitLog | null = null;
		for (const entry of journal) {
			if (
				entry.exitLog &&
				(!latest || entry.exitLog.timestamp > latest.timestamp)
			) {
				latest = entry.exitLog;
			}
		}
		return latest;
	}

	restorePendingChanges(): Promise<boolean> {
		return this.queue.run(async () => {
			const journal = await this.stateStore.readPendingJournal();
			if (journal.length === 0) return false;

			let restored = false;
			for (const entry of journal) {
				if (entry.operation === "delete") {
					const noteId = entry.filePath.replace(/\.md$/, "");
					await storageEngine.deleteNote(noteId);
					await NotesIndexService.deleteNote(noteId);
					restored = true;
					continue;
				}

				if (!entry.note) continue;

				const saved = await storageEngine.saveNote(entry.note);
				await NotesIndexService.upsertNote({
					noteId: saved.id,
					summary: extractSummary(saved.content),
					title: saved.title,
					isPinned: saved.isPinned,
					updatedAt: saved.lastUpdated,
					noteType: saved.noteType,
					status: saved.status ?? null,
				});
				restored = true;
			}

			return restored;
		});
	}

	removeFlushedEntries(snapshot: GitJournalEntry[]): Promise<void> {
		return this.queue.run(async () => {
			const currentJournal = await this.stateStore.readPendingJournal();
			const snapshotKeys = new Set(
				snapshot.map((entry) => `${entry.filePath}:${entry.updatedAt}`),
			);
			await this.write(
				currentJournal.filter(
					(entry) => !snapshotKeys.has(`${entry.filePath}:${entry.updatedAt}`),
				),
			);
		});
	}

	private write(entries: GitJournalEntry[]): Promise<void> {
		return this.stateStore.writePendingJournal(entries);
	}
}
