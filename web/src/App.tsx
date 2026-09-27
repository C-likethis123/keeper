import { ToastOverlay } from "@/components/shared/Toast";
import ErrorScreen from "@/components/shared/ErrorScreen";
import Loader from "@/components/shared/Loader";
import { darkTheme } from "@/constants/themes/darkTheme";
import { lightTheme } from "@/constants/themes/lightTheme";
import { deriveNoteType } from "@/services/notes/noteTypeDerivation";
import { useTabStore } from "@/stores/tabStore";
import { ThemeProvider } from "@react-navigation/native";
import { BrowserAttachVideoModal } from "@web/adapters/browser/editor/BrowserAttachVideoModal";
import { BrowserDrawingEditor } from "@web/adapters/browser/editor/BrowserDrawingEditor";
import { BrowserEditorHeader } from "@web/adapters/browser/editor/BrowserEditorHeader";
import { BrowserEditorSidePanelHost } from "@web/adapters/browser/editor/BrowserEditorSidePanelHost";
import { BrowserNoteHistoryModal } from "@web/adapters/browser/editor/BrowserNoteHistoryModal";
import { BrowserNoteMetadata } from "@web/adapters/browser/editor/BrowserNoteMetadata";
import { BrowserRelatedNotes } from "@web/adapters/browser/editor/BrowserRelatedNotes";
import { BrowserTemplatePicker } from "@web/adapters/browser/editor/BrowserTemplatePicker";
import { useBrowserAutoSave } from "@web/adapters/browser/editor/useBrowserAutoSave";
import { useBrowserEditorSession } from "@web/adapters/browser/editor/useBrowserEditorSession";
import { resolveOrCreateWikiLinkNoteId } from "@web/adapters/browser/wikiLinkUtils";
import { HomeRoute } from "@web/routes/HomeRoute";
import {
	deleteStoredBrowserFile,
	pickBrowserFile,
	saveBytes,
	savePickedFile,
} from "@web/services/media";
import { ViteAppShell } from "@web/shell/ViteAppShell";
import {
	BrowserNotesProvider,
	useBrowserNotes,
} from "@web/state/BrowserNotesProvider";
import { LexicalEditor } from "@web/ui/LexicalEditor";
import {
	getBrowserNoteSurface,
	loadBrowserNotes,
	type BrowserNote,
	type BrowserNoteSurface,
} from "@web/ui/noteRepository";
import { useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import {
	Link,
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
	useParams,
} from "react-router-dom";

type EditorPanel = "document" | "video" | "article";

function typeLabel(type: BrowserNoteSurface) {
	return {
		note: "Note",
		document: "Document",
		video: "Video",
		drawing: "Drawing",
	}[type];
}

function EditorRoute() {
	const { noteId = "" } = useParams();
	const { pathname } = useLocation();
	const { notes, ready, loadError, reloadNotes } = useBrowserNotes();
	if (!ready) return <Loader />;
	if (loadError)
		return <ErrorScreen error={loadError} onRetry={() => void reloadNotes()} />;
	const note = notes.find((item) => item.id === noteId);
	if (!note)
		return (
			<main className="page">
				<section className="empty-state">
					<h1>Note not found</h1>
					<Link to="/">Back home</Link>
				</section>
			</main>
		);
	const preferredPanel: EditorPanel | null = pathname.startsWith("/documents/")
		? "document"
		: pathname.startsWith("/videos/")
			? "video"
			: null;
	return (
		<EditorRouteContent
			key={`${note.id}:${preferredPanel ?? "editor"}`}
			note={note}
			preferredPanel={preferredPanel}
		/>
	);
}

function initialPanel(
	note: BrowserNote,
	preferredPanel: EditorPanel | null,
): EditorPanel | null {
	if (preferredPanel === "document" && note.attachment) return "document";
	if (preferredPanel === "video" && note.attachedVideo) return "video";
	if (note.attachedVideo) return "video";
	if (note.resourceUrl) return "article";
	if (note.attachment) return "document";
	return null;
}

function EditorRouteContent({
	note,
	preferredPanel,
}: {
	note: BrowserNote;
	preferredPanel: EditorPanel | null;
}) {
	const { notes, saveNote, deleteNote, notify } = useBrowserNotes();
	const navigate = useNavigate();
	const persistence = useMemo(
		() => ({ save: saveNote, remove: deleteNote }),
		[saveNote, deleteNote],
	);
	const session = useBrowserEditorSession(note, persistence);
	const local = session.note;
	const [historyOpen, setHistoryOpen] = useState(false);
	const [templateOpen, setTemplateOpen] = useState(false);
	const [videoModalOpen, setVideoModalOpen] = useState(false);
	const [relatedOpen, setRelatedOpen] = useState(false);
	const [activePanel, setActivePanel] = useState<EditorPanel | null>(() =>
		initialPanel(note, preferredPanel),
	);
	const [editorInstanceKey, setEditorInstanceKey] = useState(0);
	const [templateCommand, setTemplateCommand] = useState<{
		markdown: string;
		timestamp: number;
	} | null>(null);
	const openTab = useTabStore((state) => state.openTab);
	const updateTabTitle = useTabStore((state) => state.updateTabTitle);
	const tabs = useTabStore((state) => state.tabs);
	const localNoteId = note?.id;
	const localTitle = local.title || "Untitled";
	useEffect(() => {
		if (localNoteId) openTab(localNoteId, localTitle);
	}, [localNoteId, localTitle, openTab]);
	useEffect(() => {
		if (!localNoteId) return;
		const tab = tabs.find((item) => item.noteId === localNoteId);
		if (tab && tab.title !== localTitle) updateTabTitle(tab.id, localTitle);
	}, [localNoteId, localTitle, tabs, updateTabTitle]);
	useBrowserAutoSave({
		dirty: session.isDirty,
		save: session.save,
		onError: () => notify("Autosave failed."),
	});
	function update(change: Partial<BrowserNote>) {
		session.patchBrowser(change);
	}
	function changeTitle(title: string) {
		const derived = deriveNoteType(title);
		const noteType = derived === "note" ? local.noteType : derived;
		session.patch({
			title,
			noteType,
			status: noteType === "todo" ? (local.status ?? "open") : null,
		});
	}
	async function save() {
		await session.save();
	}
	async function handleBack() {
		try {
			await save();
			navigate("/");
		} catch {
			notify("Failed to save note.");
		}
	}
	async function handleDelete() {
		try {
			await session.remove();
			navigate("/");
		} catch {
			notify("Failed to delete note.");
		}
	}
	async function togglePin() {
		const isPinned = !local.isPinned;
		session.patch({ isPinned });
		try {
			await saveNote({
				...local,
				isPinned,
				lastUpdated: Date.now(),
				modified: Date.now(),
			});
		} catch {
			notify("Failed to update pin.");
		}
	}
	async function removeAttachment() {
		const attachment = local.attachment;
		const next = {
			...local,
			attachment: null,
			documentPositions: null,
			lastUpdated: Date.now(),
			modified: Date.now(),
		};
		session.patchBrowser({ attachment: null, documentPositions: null });
		try {
			if (attachment) await deleteStoredBrowserFile(attachment);
			await saveNote(next);
			setActivePanel(null);
		} catch {
			notify("Failed to remove attachment.");
		}
	}
	async function saveDocumentPosition(path: string, position: string) {
		const documentPositions = {
			...(local.documentPositions ?? {}),
			[path]: position,
		};
		session.patchBrowser({ documentPositions });
		try {
			await saveNote({
				...local,
				documentPositions,
				lastUpdated: Date.now(),
				modified: Date.now(),
			});
		} catch {
			notify("Failed to save document position.");
		}
	}
	async function openHistory() {
		try {
			await save();
			setHistoryOpen(true);
		} catch {
			notify("Failed to open version history.");
		}
	}
	async function restoreVersion(version: { note: BrowserNote }) {
		await session.restore(version.note);
		setEditorInstanceKey((key) => key + 1);
		notify("Version restored.");
	}
	async function requestImage() {
		const file = await pickBrowserFile("image/*");
		return file
			? { src: await savePickedFile(file, "assets"), altText: file.name }
			: null;
	}
	async function pasteImage(image: { bytes: Uint8Array; name: string }) {
		return {
			src: await saveBytes(image.bytes, image.name, "assets"),
			altText: image.name,
		};
	}
	async function attachDocument() {
		try {
			const file = await pickBrowserFile(
				"application/pdf,application/epub+zip,.pdf,.epub",
			);
			if (!file) return;
			const attachment = await savePickedFile(file, "attachments");
			const next = {
				...local,
				attachment,
				documentPositions: null,
				lastUpdated: Date.now(),
				modified: Date.now(),
			};
			session.patchBrowser({ attachment, documentPositions: null });
			await saveNote(next);
			setActivePanel("document");
		} catch {
			notify("Failed to attach document.");
		}
	}
	function handleEditorAttachDocument() {
		if (local.attachment) {
			setActivePanel("document");
			return;
		}
		void attachDocument();
	}
	async function attachVideo(url: string) {
		const next = {
			...local,
			attachedVideo: url,
			lastUpdated: Date.now(),
			modified: Date.now(),
		};
		session.patchBrowser({ attachedVideo: url });
		try {
			await saveNote(next);
			setActivePanel("video");
			setVideoModalOpen(false);
		} catch {
			notify("Failed to attach video.");
		}
	}
	async function removeVideo() {
		const next = {
			...local,
			attachedVideo: null,
			lastUpdated: Date.now(),
			modified: Date.now(),
		};
		session.patchBrowser({ attachedVideo: null });
		try {
			await saveNote(next);
			setActivePanel(null);
			setVideoModalOpen(false);
		} catch {
			notify("Failed to remove video.");
		}
	}
	function showVideoModal() {
		setVideoModalOpen(true);
	}
	const openWikiLink = async (title: string) => {
		try {
			await save();
			const linkedId = await resolveOrCreateWikiLinkNoteId(title);
			if (!linkedId) return;
			const target =
				notes.find((item) => item.id === linkedId) ??
				(await loadBrowserNotes()).find((item) => item.id === linkedId);
			openTab(linkedId, target?.title || title);
			navigate(`/editor/${linkedId}`);
		} catch {
			notify("Failed to open linked note.");
		}
	};
	const toggleActivePanel = () => {
		const available = [
			local.attachment ? "document" : null,
			local.attachedVideo ? "video" : null,
			local.resourceUrl ? "article" : null,
		].filter(Boolean) as Array<"document" | "video" | "article">;
		const last = available.at(-1);
		if (!last) return;
		setActivePanel(
			(current) =>
				available[
					(Math.max(available.indexOf(current ?? last), -1) + 1) %
						available.length
				],
		);
	};
	const navigateToRelatedNote = async (id: string) => {
		try {
			await save();
			navigate(`/editor/${id}`);
		} catch {
			notify("Failed to save note.");
		}
	};
	return (
		<main className="page editor-page">
			<section className="editor-shell">
				<BrowserEditorHeader
					title={session.draft.title}
					status={session.status}
					isPinned={session.draft.isPinned}
					onChangeTitle={changeTitle}
					onBlurTitle={() => {
						if (local.noteType === "drawing")
							void save().catch(() => notify("Failed to save drawing."));
					}}
					onSubmitEditing={() => {
						if (local.noteType === "drawing") {
							void save().catch(() => notify("Failed to save drawing."));
							return;
						}
						document
							.querySelector<HTMLElement>("[aria-label='Note content']")
							?.focus();
					}}
					onBack={() => {
						void handleBack();
					}}
					onShowHistory={() => {
						void openHistory();
					}}
					onTogglePin={() => {
						void togglePin();
					}}
					onDelete={() => {
						void handleDelete();
					}}
				/>
				<BrowserNoteMetadata
					noteType={local.noteType}
					status={local.status}
					onStatus={(status) => update({ status })}
				/>
				<BrowserEditorSidePanelHost
					activePanel={activePanel}
					articleUrl={local.resourceUrl}
					attachmentPath={local.attachment}
					noteId={local.id}
					videoUrl={local.attachedVideo}
					onArticleDismiss={() => setActivePanel(null)}
					onAttachmentDismiss={() => setActivePanel(null)}
					onDocumentPositionChange={saveDocumentPosition}
					onTextSelected={(text) =>
						setTemplateCommand({ markdown: `> ${text}`, timestamp: Date.now() })
					}
					onVideoDismiss={() => setActivePanel(null)}
				>
					{local.noteType === "drawing" ? (
						<BrowserDrawingEditor
							value={local.content}
							onChange={(content) => session.patch({ content })}
							onForceSave={() => {
								void save().catch(() => notify("Failed to save drawing."));
							}}
						/>
					) : (
						<LexicalEditor
							editorKey={`${local.id}-${editorInstanceKey}`}
							noteId={local.id}
							value={session.draft.content}
							onChange={(content) => session.patch({ content })}
							hasAttachment={local.attachment !== null}
							onAttachDocument={handleEditorAttachDocument}
							onRemoveAttachment={() => {
								void removeAttachment();
							}}
							onRequestImage={requestImage}
							onPasteImage={pasteImage}
							onShowVideoModal={showVideoModal}
							onInsertTemplateCommand={() => setTemplateOpen(true)}
							onOpenWikiLink={openWikiLink}
							onToggleArticle={() =>
								setActivePanel((current) =>
									current === "article" ? null : "article",
								)
							}
							onToggleActivePanel={toggleActivePanel}
							onToggleRelatedNotes={() => setRelatedOpen((current) => !current)}
							onForceSave={() => {
								void save().catch(() => notify("Failed to save note."));
							}}
							templateCommand={templateCommand}
						/>
					)}
				</BrowserEditorSidePanelHost>
				{relatedOpen ? (
					<div className="browser-related-notes-container">
						<BrowserRelatedNotes
							note={local}
							notes={notes}
							onNavigate={(id) => {
								void navigateToRelatedNote(id);
							}}
						/>
					</div>
				) : null}
				<BrowserNoteHistoryModal
					open={historyOpen}
					note={local}
					onDismiss={() => setHistoryOpen(false)}
					onRestore={restoreVersion}
				/>
				<BrowserTemplatePicker
					open={templateOpen}
					templates={notes.filter((item) => item.noteType === "template")}
					onDismiss={() => setTemplateOpen(false)}
					onApply={(markdown) => {
						session.patch({ content: markdown });
						setEditorInstanceKey((key) => key + 1);
						setTemplateOpen(false);
						notify("Template applied.");
					}}
				/>
				<BrowserAttachVideoModal
					visible={videoModalOpen}
					currentVideo={local.attachedVideo}
					onDismiss={() => setVideoModalOpen(false)}
					onSave={(url) => {
						void attachVideo(url);
					}}
					onRemove={() => {
						void removeVideo();
					}}
				/>
			</section>
		</main>
	);
}

function SuggestedMocsRoute() {
	const { notes } = useBrowserNotes();
	const suggestions = useMemo(
		() => notes.filter((note) => note.content.length > 40).slice(0, 5),
		[notes],
	);
	return (
		<main className="page">
			<div className="page-heading">
				<div>
					<p className="eyebrow">MOC screen</p>
					<h1>Suggested MOCs</h1>
					<p>Review browser-generated note groups.</p>
				</div>
				<Link to="/">Back</Link>
			</div>
			<section className="moc-list">
				{suggestions.length ? (
					suggestions.map((note) => (
						<article key={note.id} className="surface">
							<h2>{note.title || "Untitled"}</h2>
							<p>
								Candidate map entry · {typeLabel(getBrowserNoteSurface(note))}
							</p>
							<Link to={`/editor/${note.id}`}>Open note</Link>
						</article>
					))
				) : (
					<section className="empty-state">
						<h2>No suggestions yet</h2>
						<p>
							Add content to notes. MOC screen works without server classifier.
						</p>
					</section>
				)}
			</section>
		</main>
	);
}

function RoutedApp() {
	return (
		<BrowserNotesProvider>
			<ViteAppShell>
				<Routes>
					<Route path="/" element={<HomeRoute />} />
					<Route path="/editor/:noteId" element={<EditorRoute />} />
					<Route path="/suggested-mocs" element={<SuggestedMocsRoute />} />
					<Route path="/documents/:noteId" element={<EditorRoute />} />
					<Route path="/videos/:noteId" element={<EditorRoute />} />
					<Route path="/drawing/:noteId" element={<EditorRoute />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</ViteAppShell>
			<ToastOverlay />
		</BrowserNotesProvider>
	);
}

export function App() {
	const colorScheme = useColorScheme();
	return (
		<ThemeProvider value={colorScheme === "light" ? lightTheme : darkTheme}>
			<RoutedApp />
		</ThemeProvider>
	);
}
