import { LexicalEditor } from "@web/ui/LexicalEditor";
import { BrowserDrawingEditor } from "@web/adapters/browser/editor/BrowserDrawingEditor";
import { BrowserTabStrip } from "@web/adapters/browser/tabs/BrowserTabStrip";
import { BrowserEditorHeader } from "@web/adapters/browser/editor/BrowserEditorHeader";
import { BrowserNoteHistoryModal } from "@web/adapters/browser/editor/BrowserNoteHistoryModal";
import { BrowserRelatedNotes } from "@web/adapters/browser/editor/BrowserRelatedNotes";
import { BrowserNoteMetadata } from "@web/adapters/browser/editor/BrowserNoteMetadata";
import { BrowserEditorSidePanelHost } from "@web/adapters/browser/editor/BrowserEditorSidePanelHost";
import { BrowserTemplatePicker } from "@web/adapters/browser/editor/BrowserTemplatePicker";
import { BrowserAttachVideoModal } from "@web/adapters/browser/editor/BrowserAttachVideoModal";
import { useBrowserEditorSession } from "@web/adapters/browser/editor/useBrowserEditorSession";
import { useBrowserAutoSave } from "@web/adapters/browser/editor/useBrowserAutoSave";
import {
	captureBrowserNoteVersion,
	deleteBrowserNoteVersions,
} from "@web/services/noteHistory";
import {
	pickBrowserFile,
	deleteStoredBrowserFile,
	saveBytes,
	savePickedFile,
} from "@web/services/media";
import {
	enqueueBrowserNoteDelete,
	enqueueBrowserNoteSave,
	queueMissingBrowserNotes,
	syncBrowserNotes,
} from "@web/services/noteSync";
import { useTabStore } from "@keeper/stores/tabStore";
import { deriveNoteType } from "@keeper/services/notes/noteTypeDerivation";
import { resolveOrCreateWikiLinkNoteId } from "@web/adapters/browser/wikiLinkUtils";
import {
	BROWSER_NOTES_CHANGED,
	getBrowserNoteSurface,
	type BrowserNote,
	type BrowserNoteSurface,
	loadBrowserNotes,
	persistBrowserNotes,
} from "@web/ui/noteRepository";
import {
	Link,
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
	useParams,
} from "react-router-dom";
import {
	createContext,
	type FormEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

type NotesContextValue = {
	notes: BrowserNote[];
	ready: boolean;
	createNote(surface?: BrowserNoteSurface, title?: string): BrowserNote;
	saveNote(note: BrowserNote): Promise<void>;
	deleteNote(id: string): Promise<void>;
	notify(message: string): void;
};
const NotesContext = createContext<NotesContextValue | null>(null);
const TYPES: BrowserNoteSurface[] = ["note", "document", "video", "drawing"];
function useNotes() {
	const value = useContext(NotesContext);
	if (!value) throw new Error("Missing Vite notes provider");
	return value;
}
function typeLabel(type: BrowserNoteSurface) {
	return {
		note: "Note",
		document: "Document",
		video: "Video",
		drawing: "Drawing",
	}[type];
}
function changedNote(previous: BrowserNote, next: BrowserNote) {
	return (
		previous.title !== next.title ||
		previous.content !== next.content ||
		previous.noteType !== next.noteType ||
		previous.isPinned !== next.isPinned ||
		previous.attachment !== next.attachment ||
		previous.attachedVideo !== next.attachedVideo ||
		previous.resourceUrl !== next.resourceUrl ||
		previous.status !== next.status
	);
}

function AppShell({ children }: { children: ReactNode }) {
	const { notes, createNote } = useNotes();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();
	const tabs = useTabStore((state) => state.tabs);
	const activeTabId = useTabStore((state) => state.activeTabId);
	const activateTab = useTabStore((state) => state.activateTab);
	const closeTab = useTabStore((state) => state.closeTab);
	const pinTab = useTabStore((state) => state.pinTab);
	function newNote(type: BrowserNoteSurface = "note") {
		const note = createNote(type);
		navigate(`/editor/${note.id}`);
	}
	function selectTab(tab: (typeof tabs)[number]) {
		activateTab(tab.id);
		navigate(`/editor/${tab.noteId}`);
	}
	function removeTab(tabId: string) {
		closeTab(tabId);
		const next = useTabStore
			.getState()
			.tabs.find((tab) => tab.id === useTabStore.getState().activeTabId);
		if (location.pathname !== "/")
			navigate(next ? `/editor/${next.noteId}` : "/");
	}
	return (
		<div className="app-shell">
			<aside
				className={`drawer ${drawerOpen ? "drawer--open" : ""}`}
				aria-label="Keeper navigation"
			>
				<div className="drawer__brand">
					<Link to="/" onClick={() => setDrawerOpen(false)}>
						Keeper
					</Link>
				</div>
				<nav>
					<Link to="/" onClick={() => setDrawerOpen(false)}>
						Home
					</Link>
					<Link to="/suggested-mocs" onClick={() => setDrawerOpen(false)}>
						Suggested MOCs
					</Link>
				</nav>
				<div className="drawer__section">
					<span>Recent notes</span>
					{notes.slice(0, 6).map((note) => (
						<Link
							key={note.id}
							to={`/editor/${note.id}`}
							onClick={() => setDrawerOpen(false)}
						>
							{note.title || "Untitled"}
						</Link>
					))}
				</div>
			</aside>
			{drawerOpen ? (
				<button
					type="button"
					aria-label="Close navigation"
					className="drawer-backdrop"
					onClick={() => setDrawerOpen(false)}
				/>
			) : null}
			<div className="app-main">
				<header className="app-header">
					<button
						type="button"
						className="icon-button"
						aria-label="Open navigation"
						onClick={() => setDrawerOpen(true)}
					>
						☰
					</button>
					<Link className="app-header__title" to="/">
						Keeper
					</Link>
					<div className="new-menu">
						<button type="button" className="button" onClick={() => newNote()}>
							New note
						</button>
						<button
							type="button"
							className="icon-button"
							aria-label="New drawing"
							onClick={() => newNote("drawing")}
						>
							✎
						</button>
					</div>
				</header>
				<BrowserTabStrip
					tabs={tabs}
					activeTabId={activeTabId}
					activeView={location.pathname === "/" ? "home" : "note"}
					onActivateHome={() => navigate("/")}
					onActivateTab={selectTab}
					onCloseTab={removeTab}
					onTogglePin={pinTab}
				/>
				{children}
			</div>
		</div>
	);
}

function HomeRoute() {
	const { notes, createNote, deleteNote, saveNote } = useNotes();
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<"all" | BrowserNoteSurface>("all");
	const [draft, setDraft] = useState("");
	const filtered = notes.filter(
		(note) =>
			(filter === "all" || getBrowserNoteSurface(note) === filter) &&
			`${note.title}\n${note.content}`
				.toLocaleLowerCase()
				.includes(query.toLocaleLowerCase()),
	);
	function create(type: BrowserNoteSurface = "note") {
		const note = createNote(type);
		navigate(`/editor/${note.id}`);
	}
	function quickCreate(event: FormEvent) {
		event.preventDefault();
		if (!draft.trim()) return;
		const note = createNote("note", draft.trim());
		setDraft("");
		navigate(`/editor/${note.id}`);
	}
	return (
		<main className="page home-page">
			<section className="home-toolbar">
				<form onSubmit={quickCreate} className="quick-composer">
					<input
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="Take a note…"
						aria-label="Quick note title"
					/>
					<button type="submit" className="button">
						Create
					</button>
				</form>
				<input
					className="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search notes"
					aria-label="Search notes"
				/>
			</section>
			<div className="filter-row" aria-label="Note filters">
				<button
					type="button"
					className={filter === "all" ? "filter filter--selected" : "filter"}
					onClick={() => setFilter("all")}
				>
					All
				</button>
				{TYPES.map((type) => (
					<button
						type="button"
						key={type}
						className={filter === type ? "filter filter--selected" : "filter"}
						onClick={() => setFilter(type)}
					>
						{typeLabel(type)}
					</button>
				))}
			</div>
			<div className="home-heading">
				<div>
					<p className="eyebrow">Browser route</p>
					<h1>Notes</h1>
				</div>
				<div className="note-type-actions">
					{TYPES.slice(1).map((type) => (
						<button type="button" key={type} onClick={() => create(type)}>
							{typeLabel(type)}
						</button>
					))}
				</div>
			</div>
			{filtered.length ? (
				<section className="note-grid" aria-label="Notes">
					{filtered.map((note) => (
						<article key={note.id} className="note-card">
							<Link to={`/editor/${note.id}`}>
								<span className="note-card__type">
									{typeLabel(getBrowserNoteSurface(note))}
								</span>
								<h2>{note.title || "Untitled"}</h2>
								<p>
									{note.content.replace(/[#*`]/g, "").slice(0, 140) ||
										"Empty note"}
								</p>
							</Link>
							<footer>
								<time>{new Date(note.lastUpdated).toLocaleDateString()}</time>
								<button
									type="button"
									onClick={() =>
										saveNote({ ...note, isPinned: !note.isPinned })
									}
								>
									{note.isPinned ? "Unpin" : "Pin"}
								</button>
								<button type="button" onClick={() => deleteNote(note.id)}>
									Delete
								</button>
							</footer>
						</article>
					))}
				</section>
			) : (
				<section className="empty-state">
					<h2>No notes found</h2>
					<p>Create note. Browser storage ready.</p>
					<button type="button" className="button" onClick={() => create()}>
						Create note
					</button>
				</section>
			)}
		</main>
	);
}

function EditorRoute() {
	const { noteId = "" } = useParams();
	const { notes, saveNote, deleteNote, notify } = useNotes();
	const navigate = useNavigate();
	const note = notes.find((item) => item.id === noteId);
	const fallbackNote = useMemo<BrowserNote>(
		() => ({
			id: noteId,
			title: "",
			content: "",
			noteType: "note",
			isPinned: false,
			lastUpdated: 0,
			modified: null,
			status: null,
			createdAt: null,
			completedAt: null,
			attachment: null,
			attachedVideo: null,
			resourceUrl: null,
			documentPositions: null,
		}),
		[noteId],
	);
	const persistence = useMemo(
		() => ({ save: saveNote, remove: deleteNote }),
		[saveNote, deleteNote],
	);
	const session = useBrowserEditorSession(note ?? fallbackNote, persistence);
	const local = session.note;
	const [historyOpen, setHistoryOpen] = useState(false);
	const [templateOpen, setTemplateOpen] = useState(false);
	const [videoModalOpen, setVideoModalOpen] = useState(false);
	const [relatedOpen, setRelatedOpen] = useState(false);
	const [activePanel, setActivePanel] = useState<
		"document" | "video" | "article" | null
	>(null);
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
	if (!note)
		return (
			<main className="page">
				<section className="empty-state">
					<h1>Note not found</h1>
					<Link to="/">Back home</Link>
				</section>
			</main>
		);
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
	const surface = getBrowserNoteSurface(local);
	function changeSurface(next: BrowserNoteSurface) {
		const timestamp = Date.now();
		if (next === "drawing")
			update({
				noteType: "drawing",
				attachment: null,
				attachedVideo: null,
				lastUpdated: timestamp,
				modified: timestamp,
			});
		else if (next === "document")
			update({
				noteType: "note",
				attachment: local.attachment ?? "",
				attachedVideo: null,
				lastUpdated: timestamp,
				modified: timestamp,
			});
		else if (next === "video")
			update({
				noteType: "note",
				attachment: null,
				attachedVideo: local.attachedVideo ?? "",
				lastUpdated: timestamp,
				modified: timestamp,
			});
		else
			update({
				noteType: "note",
				attachment: null,
				attachedVideo: null,
				lastUpdated: timestamp,
				modified: timestamp,
			});
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
					onNoteType={(noteType) =>
						update({
							noteType,
							status: noteType === "todo" ? (local.status ?? "open") : null,
						})
					}
					onStatus={(status) => update({ status })}
				/>
				{local.noteType === "resource" ? (
					<div className="browser-editor-type">
						<label htmlFor="resource-url">Resource URL</label>
						<input
							id="resource-url"
							aria-label="Resource URL"
							value={local.resourceUrl ?? ""}
							onChange={(event) => update({ resourceUrl: event.target.value })}
							placeholder="https://…"
						/>
					</div>
				) : null}
				<div className="browser-editor-type">
					<label htmlFor="note-surface">View</label>
					<select
						id="note-surface"
						aria-label="Note view"
						value={surface}
						onChange={(event) =>
							changeSurface(event.target.value as BrowserNoteSurface)
						}
					>
						{TYPES.map((type) => (
							<option key={type} value={type}>
								{typeLabel(type)}
							</option>
						))}
					</select>
					<button
						type="button"
						className="button"
						onClick={() => {
							void save();
						}}
					>
						Save
					</button>
				</div>
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
					onVideoDismiss={() => {
						void removeVideo();
					}}
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
							editorKey={local.id}
							value={session.draft.content}
							onChange={(content) => session.patch({ content })}
							hasAttachment={local.attachment !== null}
							onAttachDocument={() => {
								void attachDocument();
							}}
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
				<button
					type="button"
					className="button"
					onClick={() => setRelatedOpen((value) => !value)}
				>
					{relatedOpen ? "Hide related notes" : "Show related notes"}
				</button>
				{relatedOpen ? (
					<BrowserRelatedNotes
						note={local}
						notes={notes}
						onNavigate={(id) => navigate(`/editor/${id}`)}
					/>
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
						setTemplateCommand({ markdown, timestamp: Date.now() });
						setTemplateOpen(false);
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
	const { notes } = useNotes();
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
	const [notes, setNotes] = useState<BrowserNote[]>([]);
	const [ready, setReady] = useState(false);
	const [toast, setToast] = useState<string | null>(null);
	useEffect(() => {
		void loadBrowserNotes()
			.catch(() => [])
			.then((loaded) => {
				const sorted = loaded.sort((a, b) => b.lastUpdated - a.lastUpdated);
				setNotes(sorted);
				setReady(true);
				void queueMissingBrowserNotes(sorted)
					.then(() => syncBrowserNotes(sorted))
					.then(async (remote) => {
						const next = [...remote].sort(
							(a, b) => b.lastUpdated - a.lastUpdated,
						);
						setNotes(next);
						await persistBrowserNotes(next);
					})
					.catch((error) =>
						console.warn("[BrowserSync] Startup sync failed:", error),
					);
			});
	}, []);
	useEffect(() => {
		const receiveNotes = (event: Event) => {
			const next = (event as CustomEvent<BrowserNote[]>).detail;
			if (Array.isArray(next))
				setNotes([...next].sort((a, b) => b.lastUpdated - a.lastUpdated));
		};
		window.addEventListener(BROWSER_NOTES_CHANGED, receiveNotes);
		return () =>
			window.removeEventListener(BROWSER_NOTES_CHANGED, receiveNotes);
	}, []);
	useEffect(() => {
		if (!ready) return;
		const sync = () => {
			void syncBrowserNotes(notes)
				.then(async (remote) => {
					const next = [...remote].sort(
						(a, b) => b.lastUpdated - a.lastUpdated,
					);
					setNotes(next);
					await persistBrowserNotes(next);
				})
				.catch((error) => console.warn("[BrowserSync] Poll failed:", error));
		};
		window.addEventListener("online", sync);
		const poll = window.setInterval(sync, 30_000);
		return () => {
			window.removeEventListener("online", sync);
			window.clearInterval(poll);
		};
	}, [notes, ready]);
	const commit = useCallback(
		async (next: BrowserNote[], message: string) => {
			const previous = new Map(notes.map((note) => [note.id, note]));
			const versions = next.flatMap((note) => {
				const old = previous.get(note.id);
				return old && changedNote(old, note) ? [old] : [];
			});
			const sorted = next.sort((a, b) => b.lastUpdated - a.lastUpdated);
			setNotes(sorted);
			await Promise.all(versions.map(captureBrowserNoteVersion));
			await persistBrowserNotes(sorted);
			await Promise.all(
				sorted.flatMap((note) => {
					const old = previous.get(note.id);
					return !old || changedNote(old, note)
						? [enqueueBrowserNoteSave(note, !old)]
						: [];
				}),
			);
			await Promise.all(
				notes
					.filter((note) => !next.some((item) => item.id === note.id))
					.map((note) => enqueueBrowserNoteDelete(note.id)),
			);
			void syncBrowserNotes(sorted)
				.then(async (remote) => {
					const synced = [...remote].sort(
						(a, b) => b.lastUpdated - a.lastUpdated,
					);
					setNotes(synced);
					await persistBrowserNotes(synced);
				})
				.catch((error) =>
					console.warn("[BrowserSync] Save sync failed:", error),
				);
			setToast(message);
		},
		[notes],
	);
	const value = useMemo<NotesContextValue>(
		() => ({
			notes,
			ready,
			createNote: (surface = "note", title = "") => {
				const timestamp = Date.now();
				const note: BrowserNote = {
					id: crypto.randomUUID(),
					title,
					content: "",
					noteType: surface === "drawing" ? "drawing" : "note",
					isPinned: false,
					lastUpdated: timestamp,
					modified: timestamp,
					status: null,
					createdAt: timestamp,
					completedAt: null,
					attachment: surface === "document" ? "" : null,
					attachedVideo: surface === "video" ? "" : null,
					resourceUrl: null,
					documentPositions: null,
				};
				void commit([note, ...notes], "Note created locally");
				return note;
			},
			saveNote: (note) =>
				commit(
					[note, ...notes.filter((item) => item.id !== note.id)],
					"Saved locally",
				),
			deleteNote: async (id) => {
				await commit(
					notes.filter((note) => note.id !== id),
					"Deleted locally",
				);
				await deleteBrowserNoteVersions(id);
			},
			notify: setToast,
		}),
		[notes, ready, commit],
	);
	if (!ready) return <main className="startup">Opening browser storage…</main>;
	return (
		<NotesContext.Provider value={value}>
			<AppShell>
				<Routes>
					<Route path="/" element={<HomeRoute />} />
					<Route path="/editor/:noteId" element={<EditorRoute />} />
					<Route path="/suggested-mocs" element={<SuggestedMocsRoute />} />
					<Route path="/documents/:noteId" element={<EditorRoute />} />
					<Route path="/videos/:noteId" element={<EditorRoute />} />
					<Route path="/drawing/:noteId" element={<EditorRoute />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</AppShell>
			{toast ? (
				<output className="toast" onAnimationEnd={() => setToast(null)}>
					{toast}
				</output>
			) : null}
		</NotesContext.Provider>
	);
}
export function App() {
	return <RoutedApp />;
}
