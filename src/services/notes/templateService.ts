import { GitService } from "@/services/git/gitService";
import { getTemplateRelativePath } from "@/services/notes/templatePaths";
import { getStorageEngine } from "@/services/storage/storageEngine";
import { useStorageStore } from "@/stores/storageStore";
import type { NoteTemplate } from "./types";

export class TemplateService {
	static instance = new TemplateService();

	private constructor() {}

	private static assertCanWrite(): void {
		const capabilities = useStorageStore.getState().capabilities;
		if (!capabilities.canWrite) {
			throw new Error(
				capabilities.reason ?? "Storage is unavailable in read-only mode",
			);
		}
	}

	static async loadTemplate(id: string): Promise<NoteTemplate | null> {
		return getStorageEngine().loadTemplate(id);
	}

	static async saveTemplate(
		template: NoteTemplate,
		isNewTemplate = false,
	): Promise<NoteTemplate> {
		TemplateService.assertCanWrite();
		const saved = await getStorageEngine().saveTemplate({
			...template,
			id: template.id.trim(),
			title: (template.title ?? "").trim(),
		});

		GitService.queueChange(
			getTemplateRelativePath(saved.id),
			isNewTemplate ? "add" : "modify",
		);
		GitService.scheduleCommitBatch();
		return saved;
	}

	static async deleteTemplate(id: string): Promise<boolean> {
		TemplateService.assertCanWrite();
		try {
			const deleted = await getStorageEngine().deleteTemplate(id);
			if (!deleted) return false;
			GitService.queueChange(getTemplateRelativePath(id), "delete");
			GitService.scheduleCommitBatch();
			return true;
		} catch (error) {
			console.warn("Failed to delete template:", error);
			return false;
		}
	}

	static async listTemplates(): Promise<NoteTemplate[]> {
		return getStorageEngine().listTemplates();
	}
}
