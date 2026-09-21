import { DocumentPanel } from "@keeper/components/editor/document/DocumentPanel.web";
import { inferAttachmentType } from "@web/adapters/browser/attachmentStorage";

export function BrowserDocumentPanel({ attachmentPath, noteId, onDismiss, onPositionChange }: { attachmentPath: string; noteId: string; onDismiss: () => void; onPositionChange: (path: string, position: string) => void }) {
	const attachmentType = inferAttachmentType(attachmentPath);
	if (!attachmentType) return null;
	return <DocumentPanel attachmentPath={attachmentPath} attachmentType={attachmentType} noteId={noteId} onDismiss={onDismiss} onDocumentPositionChange={onPositionChange} theme="dark" />;
}
