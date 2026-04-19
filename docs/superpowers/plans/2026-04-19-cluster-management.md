# Cluster Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to manage accepted clusters: add a note to a cluster, remove a note from a cluster, and delete an entire cluster.

**Architecture:** Extend the repository with three new DB functions (`addNoteToCluster`, `removeNoteFromCluster`, `deleteCluster`), wrap them in `clusterService.ts`, then build an `AcceptedClusters` component that renders accepted clusters with member management UI and a note-picker modal.

**Tech Stack:** expo-sqlite, React Native (Pressable/Modal/FlatList), Zustand (storageStore for contentVersion), existing `useStyles`/`useExtendedTheme` patterns.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/services/notes/indexDb/repository.ts` | Modify | Add `addNoteToCluster`, `removeNoteFromCluster`, `deleteCluster` |
| `src/services/notes/clusterService.ts` | Modify | Export `clusterAddNote`, `clusterRemoveNote`, `clusterDelete` |
| `src/components/AcceptedClusters.tsx` | Create | List accepted clusters; member list with remove; delete cluster; open add-note modal |
| `src/components/AddNoteToClusterModal.tsx` | Create | Search notes by title, pick one, confirm adds it to cluster |
| `src/app/index.tsx` | Modify | Add `<AcceptedClusters />` below `<MOCSuggestions />` in listHeaderComponent |

---

### Task 1: Repository — add `addNoteToCluster`, `removeNoteFromCluster`, `deleteCluster`

**Files:**
- Modify: `src/services/notes/indexDb/repository.ts` (after the existing `upsertClustersFromJson` function, around line 580)

- [ ] **Step 1: Add the three repository functions**

Append to the bottom of `src/services/notes/indexDb/repository.ts`:

```ts
export async function addNoteToCluster(
	database: SQLiteDatabase,
	clusterId: string,
	noteId: string,
): Promise<void> {
	await database.runAsync(
		`INSERT OR IGNORE INTO cluster_members (cluster_id, note_id, score)
         VALUES (?, ?, ?)`,
		clusterId,
		noteId,
		0,
	);
}

export async function removeNoteFromCluster(
	database: SQLiteDatabase,
	clusterId: string,
	noteId: string,
): Promise<void> {
	await database.runAsync(
		"DELETE FROM cluster_members WHERE cluster_id = ? AND note_id = ?",
		clusterId,
		noteId,
	);
}

export async function deleteCluster(
	database: SQLiteDatabase,
	clusterId: string,
): Promise<void> {
	// cluster_members rows are removed automatically via ON DELETE CASCADE
	await database.runAsync("DELETE FROM clusters WHERE id = ?", clusterId);
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing ones unrelated to repository.ts).

- [ ] **Step 3: Commit**

```bash
git add src/services/notes/indexDb/repository.ts
git commit -m "feat(clusters): add addNoteToCluster, removeNoteFromCluster, deleteCluster to repository"
```

---

### Task 2: Service layer — expose new functions via `clusterService.ts`

**Files:**
- Modify: `src/services/notes/clusterService.ts`

- [ ] **Step 1: Import and re-export the three new repository functions**

At the top of `src/services/notes/clusterService.ts`, add the new imports to the existing import from `./indexDb/repository`:

```ts
import {
	acceptCluster,
	addNoteToCluster,
	deleteCluster,
	dismissCluster,
	getAcceptedClusters,
	getActiveClusters,
	getClusterMembers,
	removeNoteFromCluster,
	renameCluster,
	upsertClustersFromJson,
	type ClusterMemberRow,
	type ClusterRow,
} from "./indexDb/repository";
```

Then append these three functions to the bottom of the file:

```ts
export async function clusterAddNote(
	clusterId: string,
	noteId: string,
): Promise<void> {
	const database = await getNotesIndexDb();
	await addNoteToCluster(database, clusterId, noteId);
}

export async function clusterRemoveNote(
	clusterId: string,
	noteId: string,
): Promise<void> {
	const database = await getNotesIndexDb();
	await removeNoteFromCluster(database, clusterId, noteId);
}

export async function clusterDelete(clusterId: string): Promise<void> {
	const database = await getNotesIndexDb();
	await deleteCluster(database, clusterId);
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/notes/clusterService.ts
git commit -m "feat(clusters): expose clusterAddNote, clusterRemoveNote, clusterDelete in service layer"
```

---

### Task 3: `AddNoteToClusterModal` — search and pick a note

**Files:**
- Create: `src/components/AddNoteToClusterModal.tsx`

This modal lets the user type a search query, shows matching notes from the SQLite index, and calls `onConfirm(noteId)` when one is selected.

- [ ] **Step 1: Create the file**

```tsx
import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import { notesIndexDbSearch } from "@/services/notes/notesIndexDb";
import { useCallback, useEffect, useState } from "react";
import {
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

type AddNoteToClusterModalProps = {
	visible: boolean;
	onClose: () => void;
	onConfirm: (noteId: string, noteTitle: string) => void;
	excludeNoteIds: string[];
};

type NoteResult = { id: string; title: string };

export default function AddNoteToClusterModal({
	visible,
	onClose,
	onConfirm,
	excludeNoteIds,
}: AddNoteToClusterModalProps) {
	const styles = useStyles(createStyles);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<NoteResult[]>([]);

	const search = useCallback(
		async (q: string) => {
			const { items } = await notesIndexDbSearch(q, 20);
			setResults(
				items
					.filter((n) => !excludeNoteIds.includes(n.id))
					.map((n) => ({ id: n.id, title: n.title })),
			);
		},
		[excludeNoteIds],
	);

	useEffect(() => {
		if (visible) {
			setQuery("");
			void search("");
		}
	}, [visible, search]);

	useEffect(() => {
		void search(query);
	}, [query, search]);

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onClose}
		>
			<View style={styles.backdrop}>
				<View style={styles.card}>
					<Text style={styles.title}>Add Note to Cluster</Text>
					<TextInput
						style={styles.input}
						value={query}
						onChangeText={setQuery}
						placeholder="Search notes…"
						placeholderTextColor={styles.placeholder.color}
						autoFocus
					/>
					<FlatList
						data={results}
						keyExtractor={(item) => item.id}
						style={styles.list}
						keyboardShouldPersistTaps="handled"
						renderItem={({ item }) => (
							<Pressable
								style={styles.row}
								onPress={() => onConfirm(item.id, item.title)}
							>
								<Text style={styles.rowText} numberOfLines={1}>
									{item.title || item.id}
								</Text>
							</Pressable>
						)}
						ListEmptyComponent={
							<Text style={styles.empty}>No notes found</Text>
						}
					/>
					<Pressable style={styles.cancelButton} onPress={onClose}>
						<Text style={styles.cancelText}>Cancel</Text>
					</Pressable>
				</View>
			</View>
		</Modal>
	);
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
	return StyleSheet.create({
		backdrop: {
			flex: 1,
			backgroundColor: "rgba(0,0,0,0.4)",
			justifyContent: "flex-end",
		},
		card: {
			backgroundColor: theme.colors.background,
			borderTopLeftRadius: 16,
			borderTopRightRadius: 16,
			padding: 20,
			maxHeight: "70%",
			gap: 12,
		},
		title: {
			fontSize: 17,
			fontWeight: "700",
			color: theme.colors.text,
		},
		input: {
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			paddingHorizontal: 12,
			paddingVertical: 10,
			fontSize: 15,
			color: theme.colors.text,
			backgroundColor: theme.colors.card,
		},
		placeholder: { color: theme.colors.textSecondary },
		list: { flexGrow: 0, maxHeight: 300 },
		row: {
			paddingVertical: 12,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		rowText: { fontSize: 15, color: theme.colors.text },
		empty: {
			fontSize: 14,
			color: theme.colors.textSecondary,
			textAlign: "center",
			paddingVertical: 20,
		},
		cancelButton: {
			alignItems: "center",
			paddingVertical: 12,
			borderRadius: 10,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.card,
		},
		cancelText: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
		},
	});
}
```

- [ ] **Step 2: Check what `notesIndexDbSearch` exports**

```bash
grep -n "export.*notesIndexDbSearch\|export.*function.*Search\|export async function" /Users/chowjiaying/keeper/src/services/notes/notesIndexDb.ts | head -20
```

If `notesIndexDbSearch` does not exist with that signature, find the correct search function name and adjust the import + call in the modal accordingly. The function should accept a query string and a limit and return `{ items: Array<{id, title, ...}> }`.

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AddNoteToClusterModal.tsx
git commit -m "feat(clusters): add AddNoteToClusterModal for searching and picking notes"
```

---

### Task 4: `AcceptedClusters` — manage accepted clusters

**Files:**
- Create: `src/components/AcceptedClusters.tsx`

Shows all accepted clusters. Each card lists member note titles. Each member has a remove button. Each card has "Add Note" and "Delete Cluster" actions.

- [ ] **Step 1: Create the file**

```tsx
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { useStyles } from "@/hooks/useStyles";
import {
	clusterAddNote,
	clusterDelete,
	clusterRemoveNote,
	listAcceptedClusters,
	listClusterMembers,
	type ClusterRow,
} from "@/services/notes/clusterService";
import { notesIndexDbGetById } from "@/services/notes/notesIndexDb";
import { useStorageStore } from "@/stores/storageStore";
import AddNoteToClusterModal from "@/components/AddNoteToClusterModal";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { useExtendedTheme as ThemeHook } from "@/hooks/useExtendedTheme";

interface MemberEntry {
	noteId: string;
	title: string;
}

interface AcceptedClusterCard {
	cluster: ClusterRow;
	members: MemberEntry[];
}

export default function AcceptedClusters() {
	const styles = useStyles(createStyles);
	const { colors } = useExtendedTheme();
	const contentVersion = useStorageStore((s) => s.contentVersion);
	const bumpContentVersion = useStorageStore((s) => s.bumpContentVersion);

	const [cards, setCards] = useState<AcceptedClusterCard[]>([]);
	const [addNoteTarget, setAddNoteTarget] = useState<AcceptedClusterCard | null>(null);

	const loadClusters = useCallback(async () => {
		const clusters = await listAcceptedClusters();
		const loaded: AcceptedClusterCard[] = await Promise.all(
			clusters.map(async (cluster) => {
				const memberRows = await listClusterMembers(cluster.id);
				const members: MemberEntry[] = await Promise.all(
					memberRows.map(async (row) => {
						const note = await notesIndexDbGetById(row.note_id);
						return { noteId: row.note_id, title: note?.title ?? row.note_id };
					}),
				);
				return { cluster, members };
			}),
		);
		setCards(loaded);
	}, []);

	useEffect(() => {
		void contentVersion;
		void loadClusters();
	}, [loadClusters, contentVersion]);

	const handleRemoveNote = useCallback(
		async (clusterId: string, noteId: string) => {
			await clusterRemoveNote(clusterId, noteId);
			bumpContentVersion();
			await loadClusters();
		},
		[loadClusters, bumpContentVersion],
	);

	const handleDeleteCluster = useCallback(
		(card: AcceptedClusterCard) => {
			Alert.alert(
				"Delete Cluster",
				`Delete "${card.cluster.name}"? This cannot be undone.`,
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Delete",
						style: "destructive",
						onPress: async () => {
							await clusterDelete(card.cluster.id);
							bumpContentVersion();
							await loadClusters();
						},
					},
				],
			);
		},
		[loadClusters, bumpContentVersion],
	);

	const handleAddNoteConfirm = useCallback(
		async (noteId: string) => {
			if (!addNoteTarget) return;
			await clusterAddNote(addNoteTarget.cluster.id, noteId);
			setAddNoteTarget(null);
			bumpContentVersion();
			await loadClusters();
		},
		[addNoteTarget, loadClusters, bumpContentVersion],
	);

	if (cards.length === 0) return null;

	return (
		<View style={styles.container}>
			<AddNoteToClusterModal
				visible={addNoteTarget !== null}
				onClose={() => setAddNoteTarget(null)}
				onConfirm={handleAddNoteConfirm}
				excludeNoteIds={addNoteTarget?.members.map((m) => m.noteId) ?? []}
			/>
			<Text style={styles.sectionHeader}>Your MOCs</Text>
			{cards.map((card) => (
				<View
					key={card.cluster.id}
					style={[
						styles.card,
						{ backgroundColor: colors.card, borderColor: colors.border },
					]}
				>
					<Text style={styles.clusterName} numberOfLines={1}>
						{card.cluster.name}
					</Text>

					{card.members.map((member) => (
						<View key={member.noteId} style={styles.memberRow}>
							<Text
								style={styles.memberTitle}
								numberOfLines={1}
							>
								{member.title}
							</Text>
							<Pressable
								onPress={() =>
									handleRemoveNote(card.cluster.id, member.noteId)
								}
								hitSlop={8}
								accessibilityLabel={`Remove ${member.title} from cluster`}
							>
								<Text style={styles.removeBtn}>✕</Text>
							</Pressable>
						</View>
					))}

					<View style={styles.actions}>
						<Pressable
							onPress={() => setAddNoteTarget(card)}
							style={[
								styles.actionBtn,
								{
									backgroundColor: colors.card,
									borderWidth: 1,
									borderColor: colors.border,
								},
							]}
						>
							<Text style={[styles.actionBtnText, { color: colors.text }]}>
								+ Add Note
							</Text>
						</Pressable>
						<Pressable
							onPress={() => handleDeleteCluster(card)}
							style={[
								styles.actionBtn,
								{
									backgroundColor: colors.card,
									borderWidth: 1,
									borderColor: colors.border,
								},
							]}
						>
							<Text
								style={[
									styles.actionBtnText,
									{ color: colors.textSecondary },
								]}
							>
								Delete
							</Text>
						</Pressable>
					</View>
				</View>
			))}
		</View>
	);
}

function createStyles(theme: ReturnType<typeof ThemeHook>) {
	return StyleSheet.create({
		container: { paddingHorizontal: 4, paddingTop: 12, gap: 12 },
		sectionHeader: {
			fontSize: 13,
			fontWeight: "600",
			textTransform: "uppercase",
			letterSpacing: 0.5,
			marginBottom: 4,
			color: theme.colors.text,
		},
		card: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 8 },
		clusterName: {
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
		},
		memberRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
		},
		memberTitle: {
			flex: 1,
			fontSize: 13,
			color: theme.colors.textSecondary,
		},
		removeBtn: {
			fontSize: 13,
			color: theme.colors.textSecondary,
			paddingHorizontal: 4,
		},
		actions: { flexDirection: "row", gap: 8, marginTop: 4 },
		actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
		actionBtnText: { fontSize: 13, fontWeight: "500" },
	});
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | head -30
```

Fix any errors (likely an import path or missing type). Common fix: `notesIndexDbGetById` may need a different import path — check with:

```bash
grep -n "export.*notesIndexDbGetById\|export async function getById" /Users/chowjiaying/keeper/src/services/notes/notesIndexDb.ts | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AcceptedClusters.tsx
git commit -m "feat(clusters): add AcceptedClusters component with add note, remove note, delete cluster"
```

---

### Task 5: Wire `AcceptedClusters` into the home screen

**Files:**
- Modify: `src/app/index.tsx`

- [ ] **Step 1: Import AcceptedClusters**

At the top of `src/app/index.tsx`, add:

```ts
import AcceptedClusters from "@/components/AcceptedClusters";
```

- [ ] **Step 2: Add to listHeaderComponent**

In `IndexContent`, update the `listHeaderComponent` prop (around line 164):

```tsx
listHeaderComponent={
	<>
		<ConflictBanner />
		<HomeQuickComposer onPress={createAndOpenNote} />
		<AcceptedClusters />
		<MOCSuggestions />
	</>
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

1. Accept a cluster via `MOCSuggestions` if one exists, or seed a cluster manually via the DB.
2. Restart the app — confirmed accepted clusters appear under "Your MOCs".
3. Tap `+ Add Note`, search for a note, select it — confirmed note appears in member list.
4. Tap ✕ on a member — confirmed it is removed.
5. Tap `Delete` on a cluster, confirm — confirmed cluster card disappears.

- [ ] **Step 5: Commit**

```bash
git add src/app/index.tsx
git commit -m "feat(clusters): wire AcceptedClusters into home screen header"
```

---

## Self-Review

**Spec coverage:**
- ✅ Add a note to a cluster → `clusterAddNote` + `AddNoteToClusterModal` + "Add Note" button in AcceptedClusters
- ✅ Remove a note from a cluster → `clusterRemoveNote` + ✕ button per member in AcceptedClusters
- ✅ Remove/delete an entire cluster → `clusterDelete` + "Delete" button with Alert confirmation in AcceptedClusters

**Potential gaps to check:**
- `notesIndexDbSearch` signature — Task 3 Step 2 has an explicit grep to verify the correct function name before committing.
- `notesIndexDbGetById` import path — Task 4 Step 2 has a grep to verify.
- `clusterService.web.ts` exists — if there is a web variant of clusterService, it will also need the three new functions. Check with `cat src/services/notes/clusterService.web.ts` and mirror the additions if it exists.
