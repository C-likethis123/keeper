# MOC Section Merge Design

**Date:** 2026-04-21

## Goal

Remove the separate "Your MOCs" card list (`AcceptedClusters`) and fold accepted cluster management directly into the note grid's section headers. Each cluster section gets inline edit/add/delete icon buttons. Notes within a cluster section reveal a "Remove from cluster" option on long press.

`MOCSuggestions` is untouched.

---

## Data Model

**File:** `src/services/notes/indexDb/types.ts`

Add two optional fields to `NoteSection`:

```ts
export interface NoteSection {
  id: string;
  title: string;
  notes: Note[];
  clusterId?: string; // set for accepted cluster sections
  clusterActions?: {
    onRename: () => void;
    onAddNote: () => void;
    onDelete: () => void;
    onRemoveNote: (noteId: string) => void;
  };
}
```

---

## `useNotes` / `computeSections`

**File:** `src/hooks/useNotes.ts`

In `loadSectionMetadata`, set `clusterId: cluster.id` when pushing accepted cluster sections:

```ts
acceptedClusterSections.push({ id: cluster.id, title: cluster.name, notes, clusterId: cluster.id });
```

`clusterActions` is NOT set here — it is UI state and belongs in the view layer.

---

## `index.tsx`

**File:** `src/app/index.tsx`

### State
Add three modal targets:
```ts
const [renameTarget, setRenameTarget] = useState<NoteSection | null>(null);
const [addNoteTarget, setAddNoteTarget] = useState<NoteSection | null>(null);
const [deleteTarget, setDeleteTarget] = useState<NoteSection | null>(null);
```

### Section enhancement
Map over `sections` from `useNotes` to attach `clusterActions` to cluster sections:

```ts
const enhancedSections = useMemo(() =>
  sections.map((section) =>
    section.clusterId
      ? {
          ...section,
          clusterActions: {
            onRename: () => setRenameTarget(section),
            onAddNote: () => setAddNoteTarget(section),
            onDelete: () => setDeleteTarget(section),
            onRemoveNote: (noteId: string) => handleRemoveNote(section.clusterId!, noteId),
          },
        }
      : section,
  ),
  [sections],
);
```

### Handlers
- `handleRenameConfirm(newName)` — calls `clusterRename`, logs feedback, closes modal, calls `handleRefresh` + `bumpContentVersion`
- `handleAddNoteConfirm(noteId)` — calls `clusterAddNote`, logs feedback, closes modal, refreshes
- `handleDeleteConfirm` — calls `clusterDelete`, logs feedback (platform-native confirm: `Alert` on mobile, `window.confirm` on web), closes modal, refreshes
- `handleRemoveNote(clusterId, noteId)` — calls `clusterRemoveNote`, logs feedback, refreshes

### Modals rendered in JSX
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

Delete uses a platform-native confirm (no separate modal needed).

### `listHeaderComponent`
Remove `<AcceptedClusters />`. Keep `<MOCSuggestions />` unchanged.

Pass `enhancedSections` instead of `sections` to `NoteGrid`.

---

## `NoteGrid`

**File:** `src/components/NoteGrid.tsx`

### Section header
For sections with `clusterActions`, render icons to the right of the title:

```tsx
<View style={styles.sectionHeader}>
  <Text style={styles.sectionHeaderText}>{section.title}</Text>
  {section.clusterActions && (
    <View style={styles.sectionHeaderActions}>
      <Pressable onPress={section.clusterActions.onRename} hitSlop={8}>
        <FontAwesome name="pencil" size={14} color={theme.colors.textSecondary} />
      </Pressable>
      <Pressable onPress={section.clusterActions.onAddNote} hitSlop={8}>
        <FontAwesome name="plus" size={14} color={theme.colors.textSecondary} />
      </Pressable>
      <Pressable onPress={section.clusterActions.onDelete} hitSlop={8}>
        <FontAwesome name="trash" size={14} color={theme.colors.textSecondary} />
      </Pressable>
    </View>
  )}
</View>
```

### Note cards in cluster sections
Pass `onRemoveFromCluster` to `NoteCard` for notes in cluster sections:

```tsx
<NoteCard
  note={note}
  onDelete={onDelete}
  onPinToggle={onPinToggle}
  onRemoveFromCluster={
    currentSection.clusterActions
      ? () => currentSection.clusterActions!.onRemoveNote(note.id)
      : undefined
  }
/>
```

Since `NoteGrid` currently builds rows from chunked notes without tracking which section each row belongs to, the row-building logic needs to carry the current section reference alongside each `note-row` item.

Updated `rowData` item type:
```ts
| { type: "note-row"; notes: Note[]; clusterActions?: NoteSection["clusterActions"] }
```

---

## `NoteCard`

**File:** `src/components/NoteCard.tsx`

Add prop:
```ts
onRemoveFromCluster?: () => void;
```

On long press, when `onRemoveFromCluster` is set, show a platform-native menu:
- Mobile: `Alert` with "Remove from cluster" + "Cancel" options
- Web: `window.confirm("Remove this note from the cluster?")`

Existing tap, delete, and pin-toggle behaviors are unchanged.

---

## Deleted Files

- `src/components/AcceptedClusters.tsx` — functionality fully replaced by inline section header actions

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/notes/indexDb/types.ts` | Add `clusterId?` and `clusterActions?` to `NoteSection` |
| `src/hooks/useNotes.ts` | Set `clusterId` on cluster sections in `loadSectionMetadata` |
| `src/app/index.tsx` | Add modal state, enhance sections, add handlers, remove `AcceptedClusters` |
| `src/components/NoteGrid.tsx` | Render action icons in cluster headers; pass `onRemoveFromCluster` to `NoteCard` |
| `src/components/NoteCard.tsx` | Add `onRemoveFromCluster` prop + long-press menu |
| `src/components/AcceptedClusters.tsx` | **Delete** |
