import { GitService } from "@/services/git/gitService";
import { getTemplateRelativePath } from "@/services/notes/templatePaths";
import { getStorageEngine } from "@/services/storage/storageEngine";
import type { NoteTemplate } from "./types";

export class TemplateService {
	static instance = new TemplateService();

	private constructor() {}

	static async loadTemplate(id: string): Promise<NoteTemplate | null> {
		return getStorageEngine().loadTemplate(id);
	}

	static async saveTemplate(
		template: NoteTemplate,
		isNewTemplate = false,
	): Promise<NoteTemplate> {
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
