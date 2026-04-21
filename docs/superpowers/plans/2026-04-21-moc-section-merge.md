# MOC Section Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `AcceptedClusters` card list and fold accepted cluster management inline into the note grid's section headers and NoteCard long-press menus.

**Architecture:** `NoteSection` gains `clusterId?` + `clusterActions?`; `useNotes` stamps `clusterId` on cluster sections; `index.tsx` attaches action callbacks via `useMemo`; `NoteGrid` renders icon buttons in cluster headers and passes `onRemoveFromCluster` to `NoteCard`; `NoteCard` shows a platform-native long-press menu.

**Tech Stack:** React Native, Expo, TypeScript, `@expo/vector-icons` FontAwesome, `Alert`, `Platform`

---

### Task 1: Extend `NoteSection` type

**Files:**
- Modify: `src/services/notes/indexDb/types.ts:84-88`

- [ ] **Step 1: Add `clusterId?` and `clusterActions?` to `NoteSection`**

Replace lines 84–88:

```ts
export interface NoteSection {
  id: string;
  title: string;
  notes: Note[];
  clusterId?: string;
  clusterActions?: {
    onRename: () => void;
    onAddNote: () => void;
    onDelete: () => void;
    onRemoveNote: (noteId: string) => void;
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors on `NoteSection` itself (downstream consumers will error until later tasks fix them).

- [ ] **Step 3: Commit**

```bash
git add src/services/notes/indexDb/types.ts
git commit -m "feat: extend NoteSection with clusterId and clusterActions"
```

---

### Task 2: Stamp `clusterId` on accepted cluster sections in `useNotes`

**Files:**
- Modify: `src/hooks/useNotes.ts:141`

- [ ] **Step 1: Update the `acceptedClusterSections.push` call to include `clusterId`**

In `loadSectionMetadata` (line 141), change:

```ts
acceptedClusterSections.push({ id: cluster.id, title: cluster.name, notes });
```

to:

```ts
acceptedClusterSections.push({ id: cluster.id, title: cluster.name, notes, clusterId: cluster.id });
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | grep useNotes
```

Expected: no errors in `useNotes.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useNotes.ts
git commit -m "feat: stamp clusterId on accepted cluster sections in useNotes"
```

---

### Task 3: Update `NoteGrid` row data to track current section

**Files:**
- Modify: `src/components/NoteGrid.tsx:61-88`

The `note-row` item type must carry `clusterActions` so each row knows which section it belongs to. Currently rows don't track this.

- [ ] **Step 1: Update the `rowData` item union type and row-building loop**

Replace the `rowData` useMemo block (lines 61–88) with:

```ts
const rowData = useMemo(() => {
  const chunkNotes = (sectionNotes: Note[]) => {
    const rows: Note[][] = [];
    for (let index = 0; index < sectionNotes.length; index += numColumns) {
      rows.push(sectionNotes.slice(index, index + numColumns));
    }
    return rows;
  };

  if (sections && sections.length > 0) {
    const items: Array<
      | { type: "header"; section: NoteSection }
      | { type: "note-row"; notes: Note[]; clusterActions?: NoteSection["clusterActions"] }
    > = [];
    for (const section of sections) {
      items.push({ type: "header", section });
      for (const row of chunkNotes(section.notes)) {
        items.push({ type: "note-row", notes: row, clusterActions: section.clusterActions });
      }
    }
    return items;
  }

  return chunkNotes(notes).map((row) => ({
    type: "note-row" as const,
    notes: row,
    clusterActions: undefined,
  }));
}, [notes, numColumns, sections]);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | grep NoteGrid
```

Expected: no errors in `NoteGrid.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/NoteGrid.tsx
git commit -m "refactor: carry clusterActions through NoteGrid rowData"
```

---

### Task 4: Render cluster action icons in `NoteGrid` section headers

**Files:**
- Modify: `src/components/NoteGrid.tsx:132-165` (renderItem + styles)

- [ ] **Step 1: Add `flexDirection: "row"` layout and action icons to the section header render**

Replace the header branch in `renderItem` (lines 133–140):

```tsx
if (item.type === "header") {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{item.section.title}</Text>
      {item.section.clusterActions && (
        <View style={styles.sectionHeaderActions}>
          <Pressable onPress={item.section.clusterActions.onRename} hitSlop={8}>
            <FontAwesome name="pencil" size={14} color={theme.colors.textSecondary} />
          </Pressable>
          <Pressable onPress={item.section.clusterActions.onAddNote} hitSlop={8}>
            <FontAwesome name="plus" size={14} color={theme.colors.textSecondary} />
          </Pressable>
          <Pressable onPress={item.section.clusterActions.onDelete} hitSlop={8}>
            <FontAwesome name="trash" size={14} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
```

Also add `Pressable` to the existing React Native import at line 8.

- [ ] **Step 2: Update `sectionHeader` style to row layout and add `sectionHeaderActions` style**

In `createStyles`, replace:

```ts
sectionHeader: {
  paddingHorizontal: 8,
  paddingVertical: 12,
  marginTop: 8,
},
```

with:

```ts
sectionHeader: {
  paddingHorizontal: 8,
  paddingVertical: 12,
  marginTop: 8,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},
sectionHeaderActions: {
  flexDirection: "row",
  gap: 12,
},
```

- [ ] **Step 3: Pass `onRemoveFromCluster` to `NoteCard` for cluster rows**

Replace the `NoteCard` render inside the note-row branch (lines 147–151):

```tsx
<NoteCard
  note={note}
  onDelete={onDelete}
  onPinToggle={onPinToggle}
  onRemoveFromCluster={
    item.clusterActions
      ? () => item.clusterActions!.onRemoveNote(note.id)
      : undefined
  }
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | grep NoteGrid
```

Expected: error that `NoteCard` doesn't accept `onRemoveFromCluster` yet — that's expected and will be fixed in Task 5.

- [ ] **Step 5: Commit (pre-Task-5 checkpoint)**

```bash
git add src/components/NoteGrid.tsx
git commit -m "feat: render cluster action icons in NoteGrid section headers"
```

---

### Task 5: Add `onRemoveFromCluster` prop to `NoteCard`

**Files:**
- Modify: `src/components/NoteCard.tsx:27-35`

- [ ] **Step 1: Add the prop to the component signature**

Replace the props block (lines 27–35):

```tsx
export default function NoteCard({
  note,
  onDelete,
  onPinToggle,
  onRemoveFromCluster,
}: {
  note: Note;
  onDelete: (note: Note) => void;
  onPinToggle: (updated: Note) => void;
  onRemoveFromCluster?: () => void;
}) {
```

- [ ] **Step 2: Add `Platform` to imports and wire up a long-press handler**

Add `Platform` to the React Native import (line 8):

```ts
import {
  type GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
```

Add `Alert` to the import too:

```ts
import {
  Alert,
  type GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
```

- [ ] **Step 3: Add the `handleLongPress` function inside the component (after `stopCardPress`)**

```ts
const handleLongPress = () => {
  if (!onRemoveFromCluster) return;
  if (Platform.OS === "web") {
    if (window.confirm("Remove this note from the cluster?")) {
      onRemoveFromCluster();
    }
  } else {
    Alert.alert("Remove from cluster", "Remove this note from the cluster?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: onRemoveFromCluster },
    ]);
  }
};
```

- [ ] **Step 4: Wire `onLongPress` on the root `Pressable`**

The outer `Pressable` (line 55) currently has no `onLongPress`. Add it:

```tsx
<Pressable
  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
  onPress={openNote}
  onLongPress={onRemoveFromCluster ? handleLongPress : undefined}
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel={`Open note ${note.title || "Untitled"}`}
  accessibilityHint="Opens the note"
>
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/NoteCard.tsx
git commit -m "feat: add onRemoveFromCluster long-press to NoteCard"
```

---

### Task 6: Wire cluster actions in `index.tsx` and remove `AcceptedClusters`

**Files:**
- Modify: `src/app/index.tsx`

- [ ] **Step 1: Add imports**

After the existing imports, add:

```ts
import AddNoteToClusterModal from "@/components/AddNoteToClusterModal";
import RenameClusterModal from "@/components/RenameClusterModal";
import {
  clusterAddNote,
  clusterDelete,
  clusterRemoveNote,
  clusterRename,
} from "@/services/notes/clusterService";
import { logFeedback } from "@/services/notes/clusterFeedbackService";
import { useStorageStore } from "@/stores/storageStore";
import type { NoteSection } from "@/services/notes/indexDb/types";
import { Alert, Platform } from "react-native";
import { useMemo } from "react";
```

Note: `useMemo` may already be imported via React — check and add to the destructured import if missing.

- [ ] **Step 2: Remove the `AcceptedClusters` import**

Delete line:
```ts
import AcceptedClusters from "@/components/AcceptedClusters";
```

- [ ] **Step 3: Add modal state and `bumpContentVersion` inside `IndexContent`**

After the existing `useState` declarations (around line 50), add:

```ts
const bumpContentVersion = useStorageStore((s) => s.bumpContentVersion);
const [renameTarget, setRenameTarget] = useState<NoteSection | null>(null);
const [addNoteTarget, setAddNoteTarget] = useState<NoteSection | null>(null);
```

- [ ] **Step 4: Add `enhancedSections` memo and cluster action handlers**

After `handlePinToggle`:

```ts
const handleRemoveNote = useCallback(
  async (clusterId: string, noteId: string) => {
    await clusterRemoveNote(clusterId, noteId);
    logFeedback(clusterId, "remove_note", { noteId }).catch(() => {});
    bumpContentVersion();
    await handleRefresh();
  },
  [bumpContentVersion, handleRefresh],
);

const handleRenameConfirm = useCallback(
  async (newName: string) => {
    if (!renameTarget) return;
    await clusterRename(renameTarget.clusterId!, newName);
    logFeedback(renameTarget.clusterId!, "rename", {
      originalName: renameTarget.title,
      newName,
    }).catch(() => {});
    setRenameTarget(null);
    bumpContentVersion();
    await handleRefresh();
  },
  [renameTarget, bumpContentVersion, handleRefresh],
);

const handleAddNoteConfirm = useCallback(
  async (noteId: string) => {
    if (!addNoteTarget) return;
    await clusterAddNote(addNoteTarget.clusterId!, noteId);
    logFeedback(addNoteTarget.clusterId!, "add_note", { noteId }).catch(() => {});
    setAddNoteTarget(null);
    bumpContentVersion();
    await handleRefresh();
  },
  [addNoteTarget, bumpContentVersion, handleRefresh],
);

const handleDeleteCluster = useCallback(
  (section: NoteSection) => {
    const confirmDelete = async () => {
      await clusterDelete(section.clusterId!);
      logFeedback(section.clusterId!, "delete", {
        clusterName: section.title,
      }).catch(() => {});
      bumpContentVersion();
      await handleRefresh();
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${section.title}"? This cannot be undone.`)) {
        void confirmDelete();
      }
    } else {
      Alert.alert(
        "Delete Cluster",
        `Delete "${section.title}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: confirmDelete },
        ],
      );
    }
  },
  [bumpContentVersion, handleRefresh],
);

const enhancedSections = useMemo(
  () =>
    sections.map((section) =>
      section.clusterId
        ? {
            ...section,
            clusterActions: {
              onRename: () => setRenameTarget(section),
              onAddNote: () => setAddNoteTarget(section),
              onDelete: () => handleDeleteCluster(section),
              onRemoveNote: (noteId: string) =>
                void handleRemoveNote(section.clusterId!, noteId),
            },
          }
        : section,
    ),
  [sections, handleDeleteCluster, handleRemoveNote],
);
```

- [ ] **Step 5: Replace `sections` with `enhancedSections` in `LazyNoteGrid` and remove `<AcceptedClusters />`**

Change:
```tsx
sections={sections}
```
to:
```tsx
sections={enhancedSections}
```

Remove `<AcceptedClusters />` from `listHeaderComponent`.

- [ ] **Step 6: Add modals to JSX (just before closing `</View>` of the return)**

```tsx
<RenameClusterModal
  visible={renameTarget !== null}
  initialName={renameTarget?.title ?? ""}
  onClose={() => setRenameTarget(null)}
  onConfirm={handleRenameConfirm}
/>
<AddNoteToClusterModal
  visible={addNoteTarget !== null}
  onClose={() => setAddNoteTarget(null)}
  onConfirm={handleAddNoteConfirm}
  excludeNoteIds={addNoteTarget?.notes.map((n) => n.id) ?? []}
/>
```

- [ ] **Step 7: Verify TypeScript compiles cleanly**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/index.tsx
git commit -m "feat: inline cluster actions into index.tsx, remove AcceptedClusters"
```

---

### Task 7: Delete `AcceptedClusters.tsx`

**Files:**
- Delete: `src/components/AcceptedClusters.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm /Users/chowjiaying/keeper/src/components/AcceptedClusters.tsx
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -r "AcceptedClusters" /Users/chowjiaying/keeper/src --include="*.ts" --include="*.tsx"
```

Expected: no output.

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd /Users/chowjiaying/keeper && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Run lint**

```bash
cd /Users/chowjiaying/keeper && npm run lint 2>&1 | tail -10
```

Expected: no errors or only pre-existing warnings.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/AcceptedClusters.tsx
git commit -m "feat: delete AcceptedClusters component (replaced by inline section headers)"
```

---

## Self-Review

**Spec coverage:**
| Spec requirement | Task |
|---|---|
| Add `clusterId?` + `clusterActions?` to `NoteSection` | Task 1 |
| `useNotes` stamps `clusterId` on cluster sections | Task 2 |
| `NoteGrid` carries section reference per row | Task 3 |
| `NoteGrid` renders pencil/plus/trash icons in cluster headers | Task 4 |
| `NoteCard` receives + handles `onRemoveFromCluster` | Task 5 |
| `index.tsx` attaches action callbacks, modal state, handlers | Task 6 |
| `AcceptedClusters.tsx` deleted | Task 7 |
| `MOCSuggestions` untouched | ✓ (never touched) |
| Platform-native delete confirm (Alert/window.confirm) | Task 6 step 4 |
| Platform-native remove confirm (Alert/window.confirm) | Task 5 step 3 |

**Placeholder scan:** No TBD/TODO/placeholder language found.

**Type consistency:** `NoteSection["clusterActions"]` used consistently throughout; `clusterId` is always `string` (non-null asserted after guard). `onRemoveNote: (noteId: string) => void` matches `NoteCard`'s `onRemoveFromCluster?: () => void` (the closure captures `noteId` at the call site).
