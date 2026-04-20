# MOC Feedback Learning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the MOC suggestion architecture to learn from user reactions to suggested clusters, improving future suggestions through feedback on cluster quality, naming, and membership.

**Current State:**
- Pipeline generates clusters using semantic embeddings + multi-dimensional distance matrices (semantic, temporal, graph, tags)
- App imports `.moc_clusters.json` and shows suggestions with Accept/Dismiss/Rename actions
- Clusters can be accepted (converted to MOC notes), dismissed, or renamed
- Accepted clusters support manual note additions/removals
- **Gap:** Feedback is stored locally in SQLite but never fed back to the pipeline for learning

**Target State:**
- Detailed feedback signals captured for every user action on clusters
- Feedback exported to `.moc_feedback.json` committed to the repo
- Pipeline reads historical feedback to:
  - Adjust distance matrix weights based on accepted/dismissed patterns
  - Learn better cluster names from user renames
  - Improve similarity scoring using positive/negative note-pair signals
  - Avoid re-suggesting dismissed clusters

**Tech Stack:** TypeScript · SQLite · Python · scikit-learn · sentence-transformers

---

## Architecture Overview

### Feedback Signals to Capture

| Action | Signal | Learning Use |
|--------|--------|--------------|
| **Accept cluster** | Positive: cluster composition is good | Reinforce member pairings, adjust feature weights |
| **Dismiss cluster** | Negative: cluster should not exist | Avoid similar compositions, adjust feature weights |
| **Rename cluster** | User's preferred name | Train naming model, learn keyword extraction patterns |
| **Add note to cluster** | Positive: note belongs with cluster | Add positive pair signal (note, cluster members) |
| **Remove note from cluster** | Negative: note doesn't belong | Add negative pair signal (note, cluster members) |
| **Delete accepted cluster** | Negative: cluster was not useful | Penalize similar cluster compositions |

### Data Flow

```
User Action (App)
    ↓
SQLite clusters + cluster_members tables
    ↓
Feedback Export Service (.moc_feedback.json)
    ↓
Git commit (manual or auto)
    ↓
GitHub Actions triggers pipeline
    ↓
Pipeline reads feedback + notes
    ↓
Applies learning algorithms
    ↓
Generates improved .moc_clusters.json
```

---

## File Map

### New Files
- `src/migrations/007_add_cluster_feedback.ts` — SQLite schema for feedback events
- `src-tauri/storage_core/src/migrations/v7_add_cluster_feedback.rs` — Rust equivalent
- `src/services/notes/clusterFeedbackService.ts` — Feedback tracking + export service
- `scripts/moc_pipeline/feedback.py` — Feedback loading and learning algorithms
- `scripts/moc_pipeline/learning.py` — ML models for similarity adjustment and naming

### Modified Files
- `src/migrations/migrations.ts` — register migration 7
- `src-tauri/storage_core/src/migrations/mod.rs` — register v7
- `src/services/notes/indexDb/db.ts` — bump DATABASE_VERSION to 7
- `src/components/MOCSuggestions.tsx` — log feedback events
- `src/components/AcceptedClusters.tsx` — log feedback events
- `src/components/RenameClusterModal.tsx` — log rename feedback
- `src/components/AddNoteToClusterModal.tsx` — log note addition feedback
- `scripts/moc_pipeline/pipeline.py` — integrate feedback learning
- `docs/notes-repo-setup/moc-pipeline.yml` — commit feedback file

---

## Task 1: Add Feedback Schema (Mobile)

**Files:**
- Create: `src/migrations/007_add_cluster_feedback.ts`
- Modify: `src/migrations/migrations.ts`
- Modify: `src/services/notes/indexDb/db.ts`

- [ ] **Step 1: Write the migration**

Create `src/migrations/007_add_cluster_feedback.ts`:
```typescript
import type { SQLiteDatabase } from "expo-sqlite";

export async function migrate(db: SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS cluster_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cluster_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            event_data TEXT,
            created_at INTEGER NOT NULL
        )
    `);
    await db.execAsync("PRAGMA user_version = 7");
}
```

- [ ] **Step 2: Register the migration**

In `src/migrations/migrations.ts`:
```typescript
import { migrate as migrate007 } from "./007_add_cluster_feedback";

export const MIGRATIONS = [
    // ... existing migrations
    { version: 7, migrate: migrate007 },
];
```

- [ ] **Step 3: Bump DATABASE_VERSION in `db.ts`**

```typescript
const DATABASE_VERSION = 7;
```

- [ ] **Step 4: Commit**

```bash
git add src/migrations/007_add_cluster_feedback.ts \
        src/migrations/migrations.ts \
        src/services/notes/indexDb/db.ts
git commit -m "feat: add cluster feedback table migration (v7)"
```

---

## Task 2: Add Feedback Schema (Desktop / Rust)

**Files:**
- Create: `src-tauri/storage_core/src/migrations/v7_add_cluster_feedback.rs`
- Modify: `src-tauri/storage_core/src/migrations/mod.rs`

- [ ] **Step 1: Write the Rust migration**

Create `src-tauri/storage_core/src/migrations/v7_add_cluster_feedback.rs`:
```rust
use rusqlite::Connection;

pub fn apply(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS cluster_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cluster_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            event_data TEXT,
            created_at INTEGER NOT NULL
        );
        PRAGMA user_version = 7;",
    )
    .map_err(|e| format!("migration v7 failed: {e}"))?;
    Ok(())
}
```

- [ ] **Step 2: Register in `mod.rs`**

```rust
mod v7_add_cluster_feedback;

const MIGRATIONS: &[Migration] = &[
    // ... existing
    Migration { version: 7, apply: v7_add_cluster_feedback::apply },
];
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/storage_core/src/migrations/v7_add_cluster_feedback.rs \
        src-tauri/storage_core/src/migrations/mod.rs
git commit -m "feat: add cluster feedback table Rust migration (v7)"
```

---

## Task 3: Implement Feedback Service

**Files:**
- Create: `src/services/notes/clusterFeedbackService.ts`
- Modify: `src/services/notes/indexDb/repository.ts`

- [ ] **Step 1: Add feedback CRUD to `repository.ts`**

Append to `src/services/notes/indexDb/repository.ts`:
```typescript
// ─── Cluster Feedback ───────────────────────────────────────

export interface ClusterFeedbackRow {
    id: number;
    cluster_id: string;
    event_type: string;
    event_data: string | null;
    created_at: number;
}

export async function recordClusterFeedback(
    database: SQLiteDatabase,
    clusterId: string,
    eventType: "accept" | "dismiss" | "rename" | "add_note" | "remove_note" | "delete",
    eventData: Record<string, unknown> = {},
): Promise<void> {
    await database.runAsync(
        `INSERT INTO cluster_feedback (cluster_id, event_type, event_data, created_at)
         VALUES (?, ?, ?, ?)`,
        clusterId,
        eventType,
        JSON.stringify(eventData),
        Date.now(),
    );
}

export async function getAllClusterFeedback(
    database: SQLiteDatabase,
): Promise<ClusterFeedbackRow[]> {
    return (
        (await database.getAllAsync<ClusterFeedbackRow>(
            `SELECT id, cluster_id, event_type, event_data, created_at
             FROM cluster_feedback
             ORDER BY created_at DESC`,
        )) ?? []
    );
}

export async function exportFeedbackToJson(
    database: SQLiteDatabase,
): Promise<string> {
    const feedback = await getAllClusterFeedback(database);
    return JSON.stringify({
        version: 1,
        exported_at: Date.now(),
        events: feedback.map((f) => ({
            clusterId: f.cluster_id,
            eventType: f.event_type,
            eventData: f.event_data ? JSON.parse(f.event_data) : null,
            createdAt: f.created_at,
        })),
    }, null, 2);
}
```

- [ ] **Step 2: Create `clusterFeedbackService.ts`**

Create `src/services/notes/clusterFeedbackService.ts`:
```typescript
import { NOTES_ROOT } from "@/services/notes/Notes";
import { File } from "expo-file-system";
import {
    exportFeedbackToJson,
    recordClusterFeedback,
    getAllClusterFeedback,
} from "./indexDb/repository";
import { getNotesIndexDb } from "./indexDb/db";

const FEEDBACK_FILENAME = ".moc_feedback.json";

export async function logFeedback(
    clusterId: string,
    eventType: "accept" | "dismiss" | "rename" | "add_note" | "remove_note" | "delete",
    eventData: Record<string, unknown> = {},
): Promise<void> {
    const database = await getNotesIndexDb();
    await recordClusterFeedback(database, clusterId, eventType, eventData);
}

export async function exportFeedbackToFile(): Promise<void> {
    const database = await getNotesIndexDb();
    const json = await exportFeedbackToJson(database);
    const filePath = `${NOTES_ROOT}/${FEEDBACK_FILENAME}`;
    const file = new File(filePath);
    await file.write(json);
}

export async function getFeedbackHistory(): Promise<any[]> {
    const database = await getNotesIndexDb();
    const feedback = await getAllClusterFeedback(database);
    return feedback.map((f) => ({
        clusterId: f.cluster_id,
        eventType: f.event_type,
        eventData: f.event_data ? JSON.parse(f.event_data) : null,
        createdAt: f.created_at,
    }));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/services/notes/indexDb/repository.ts \
        src/services/notes/clusterFeedbackService.ts
git commit -m "feat: add cluster feedback tracking and export service"
```

---

## Task 4: Instrument UI Components to Log Feedback

**Files:**
- Modify: `src/components/MOCSuggestions.tsx`
- Modify: `src/components/AcceptedClusters.tsx`
- Modify: `src/components/RenameClusterModal.tsx`
- Modify: `src/components/AddNoteToClusterModal.tsx`

- [ ] **Step 1: Log feedback in `MOCSuggestions.tsx`**

```typescript
import { logFeedback } from "@/services/notes/clusterFeedbackService";

// In handleDismiss:
const handleDismiss = useCallback(
    async (clusterId: string) => {
        await clusterDismiss(clusterId);
        await logFeedback(clusterId, "dismiss", {
            originalName: card.cluster.name,
            confidence: card.cluster.confidence,
            memberCount: card.memberNoteIds.length,
        });
        bumpContentVersion();
        await loadClusters();
    },
    [loadClusters, bumpContentVersion],
);

// In handleAccept:
const handleAccept = useCallback(
    async (card: ClusterCard) => {
        await clusterAccept(card.cluster.id);
        await logFeedback(card.cluster.id, "accept", {
            originalName: card.cluster.name,
            confidence: card.cluster.confidence,
            memberCount: card.memberNoteIds.length,
            memberIds: card.memberNoteIds,
        });
        bumpContentVersion();
        await loadClusters();
    },
    [loadClusters, bumpContentVersion],
);

// In handleRenameConfirm:
const handleRenameConfirm = useCallback(
    async (newName: string) => {
        if (!renameCard) return;
        await clusterRename(renameCard.cluster.id, newName);
        await logFeedback(renameCard.cluster.id, "rename", {
            originalName: renameCard.cluster.name,
            newName,
        });
        setRenameCard(null);
        await loadClusters();
    },
    [renameCard, loadClusters],
);
```

- [ ] **Step 2: Log feedback in `AcceptedClusters.tsx`**

```typescript
import { logFeedback } from "@/services/notes/clusterFeedbackService";

// In handleRemoveNote:
const handleRemoveNote = useCallback(
    async (clusterId: string, noteId: string) => {
        await clusterRemoveNote(clusterId, noteId);
        await logFeedback(clusterId, "remove_note", {
            noteId,
            clusterName: card.cluster.name,
        });
        bumpContentVersion();
        await loadClusters();
    },
    [loadClusters, bumpContentVersion],
);

// In handleDeleteCluster:
const handleDeleteCluster = useCallback(
    async (card: AcceptedClusterCard) => {
        // ... existing confirm logic
        await clusterDelete(card.cluster.id);
        await logFeedback(card.cluster.id, "delete", {
            clusterName: card.cluster.name,
            memberCount: card.members.length,
        });
        bumpContentVersion();
        await loadClusters();
    },
    [loadClusters, bumpContentVersion],
);

// In handleAddNoteConfirm:
const handleAddNoteConfirm = useCallback(
    async (noteId: string) => {
        if (!addNoteTarget) return;
        await clusterAddNote(addNoteTarget.cluster.id, noteId);
        await logFeedback(addNoteTarget.cluster.id, "add_note", {
            noteId,
            clusterName: addNoteTarget.cluster.name,
        });
        setAddNoteTarget(null);
        bumpContentVersion();
        await loadClusters();
    },
    [addNoteTarget, loadClusters, bumpContentVersion],
);
```

- [ ] **Step 3: Add onRename callback to `RenameClusterModal.tsx`**

```typescript
type RenameClusterModalProps = {
    visible: boolean;
    initialName: string;
    onClose: () => void;
    onConfirm: (newName: string) => void;
    onRename?: (newName: string) => void; // NEW
};

// In handleConfirm:
const handleConfirm = () => {
    const trimmed = name.trim();
    if (trimmed) {
        onConfirm(trimmed);
        onRename?.(trimmed); // NEW
    }
};
```

- [ ] **Step 4: Update `MOCSuggestions.tsx` to pass onRename**

```typescript
<RenameClusterModal
    // ... existing props
    onRename={(newName) => {
        // Rename feedback is logged in handleRenameConfirm
    }}
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/components/MOCSuggestions.tsx \
        src/components/AcceptedClusters.tsx \
        src/components/RenameClusterModal.tsx \
        src/components/AddNoteToClusterModal.tsx
git commit -m "feat: log cluster feedback events from UI components"
```

---

## Task 5: Add Manual Feedback Export Trigger

**Files:**
- Modify: `src/app/_layout.tsx` (or appropriate startup file)
- Create: `src/hooks/useFeedbackExport.ts`

- [ ] **Step 1: Create feedback export hook**

Create `src/hooks/useFeedbackExport.ts`:
```typescript
import { useCallback } from "react";
import { exportFeedbackToFile } from "@/services/notes/clusterFeedbackService";

export function useFeedbackExport() {
    const exportFeedback = useCallback(async () => {
        try {
            await exportFeedbackToFile();
            console.log("Feedback exported to .moc_feedback.json");
        } catch (error) {
            console.error("Failed to export feedback:", error);
        }
    }, []);

    return { exportFeedback };
}
```

- [ ] **Step 2: Add export button to settings or debug menu**

For now, add a simple trigger. In production, this could be:
- Automatic on app close
- Manual button in settings
- Synced with git commits

Add to `_layout.tsx` or appropriate location:
```typescript
import { useFeedbackExport } from "@/hooks/useFeedbackExport";

// In component:
const { exportFeedback } = useFeedbackExport();

// Add a debug trigger (remove in production)
if (__DEV__) {
    // Expose globally for debugging
    (global as any).exportMocFeedback = exportFeedback;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFeedbackExport.ts \
        src/app/_layout.tsx
git commit -m "feat: add feedback export trigger"
```

---

## Task 6: Implement Feedback Loading in Pipeline

**Files:**
- Create: `scripts/moc_pipeline/feedback.py`
- Modify: `scripts/moc_pipeline/pipeline.py`

- [ ] **Step 1: Create `feedback.py`**

Create `scripts/moc_pipeline/feedback.py`:
```python
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json

@dataclass
class FeedbackEvent:
    cluster_id: str
    event_type: str
    event_data: dict[str, Any] | None
    created_at: int

def load_feedback(notes_root: Path) -> list[FeedbackEvent]:
    """Load feedback events from .moc_feedback.json if it exists."""
    feedback_path = notes_root / ".moc_feedback.json"
    if not feedback_path.exists():
        return []

    try:
        data = json.loads(feedback_path.read_text(encoding="utf-8"))
        events = data.get("events", [])
        return [
            FeedbackEvent(
                cluster_id=e["clusterId"],
                event_type=e["eventType"],
                event_data=e.get("eventData"),
                created_at=e["createdAt"],
            )
            for e in events
        ]
    except Exception as e:
        print(f"Warning: Failed to load feedback: {e}")
        return []

def get_positive_pairs(feedback: list[FeedbackEvent]) -> set[tuple[str, str]]:
    """
    Extract positive note-pair signals from feedback.
    Returns set of (note_id_a, note_id_b) tuples.
    """
    positive_pairs = set()

    for event in feedback:
        if event.event_type in ("accept", "add_note"):
            # For accept: all members are positively paired
            if event.event_type == "accept" and event.event_data:
                member_ids = event.event_data.get("memberIds", [])
                for i in range(len(member_ids)):
                    for j in range(i + 1, len(member_ids)):
                        pair = tuple(sorted([member_ids[i], member_ids[j]]))
                        positive_pairs.add(pair)

            # For add_note: pair with all cluster members (need cluster members lookup)
            # This requires cluster_members table access - defer to learning module

    return positive_pairs

def get_negative_pairs(feedback: list[FeedbackEvent]) -> set[tuple[str, str]]:
    """
    Extract negative note-pair signals from feedback.
    Returns set of (note_id_a, note_id_b) tuples.
    """
    negative_pairs = set()

    for event in feedback:
        if event.event_type == "dismiss":
            # Dismissed clusters: members are negatively paired
            if event.event_data and "memberIds" in event.event_data:
                member_ids = event.event_data["memberIds"]
                for i in range(len(member_ids)):
                    for j in range(i + 1, len(member_ids)):
                        pair = tuple(sorted([member_ids[i], member_ids[j]]))
                        negative_pairs.add(pair)

        elif event.event_type == "remove_note":
            # Removed note is negatively paired with cluster
            # Requires cluster members lookup

    return negative_pairs

def get_rename_examples(feedback: list[FeedbackEvent]) -> list[tuple[str, str, str]]:
    """
    Extract rename examples: (cluster_id, original_name, new_name).
    Used to train naming model.
    """
    renames = []
    for event in feedback:
        if event.event_type == "rename" and event.event_data:
            original = event.event_data.get("originalName")
            new_name = event.event_data.get("newName")
            if original and new_name:
                renames.append((event.cluster_id, original, new_name))
    return renames

def get_dismissed_cluster_ids(feedback: list[FeedbackEvent]) -> set[str]:
    """Get set of cluster IDs that were dismissed."""
    return {e.cluster_id for e in feedback if e.event_type == "dismiss"}
```

- [ ] **Step 2: Integrate feedback loading into `pipeline.py`**

In `scripts/moc_pipeline/pipeline.py`:
```python
# Add import
from feedback import (
    load_feedback,
    get_positive_pairs,
    get_negative_pairs,
    get_rename_examples,
    get_dismissed_cluster_ids,
)

# In main(), after loading notes:
print("Loading feedback...")
feedback = load_feedback(notes_root)
print(f"Found {len(feedback)} feedback events")

positive_pairs = get_positive_pairs(feedback)
negative_pairs = get_negative_pairs(feedback)
rename_examples = get_rename_examples(feedback)
dismissed_ids = get_dismissed_cluster_ids(feedback)

print(f"  Positive pairs: {len(positive_pairs)}")
print(f"  Negative pairs: {len(negative_pairs)}")
print(f"  Rename examples: {len(rename_examples)}")
print(f"  Dismissed clusters: {len(dismissed_ids)}")

# Pass feedback to learning module (next task)
# For now, just log it
```

- [ ] **Step 3: Commit**

```bash
git add scripts/moc_pipeline/feedback.py \
        scripts/moc_pipeline/pipeline.py
git commit -m "feat: add feedback loading in MOC pipeline"
```

---

## Task 7: Implement Learning Algorithms

**Files:**
- Create: `scripts/moc_pipeline/learning.py`
- Modify: `scripts/moc_pipeline/pipeline.py`

- [ ] **Step 1: Create `learning.py`**

Create `scripts/moc_pipeline/learning.py`:
```python
from __future__ import annotations
import numpy as np
from collections import defaultdict
from typing import Any

def adjust_distance_weights(
    positive_pairs: set[tuple[str, str]],
    negative_pairs: set[tuple[str, str]],
    note_id_to_index: dict[str, int],
    semantic_D: np.ndarray,
    temporal_D: np.ndarray,
    graph_D: np.ndarray,
    tag_D: np.ndarray,
    current_weights: dict[str, float],
) -> dict[str, float]:
    """
    Adjust feature weights based on feedback.
    If positive pairs have high distance in a dimension, decrease its weight.
    If negative pairs have low distance in a dimension, decrease its weight.
    """
    weights = current_weights.copy()
    learning_rate = 0.1  # Small adjustment per iteration

    # Compute average distances for positive and negative pairs per dimension
    dim_matrices = {
        "semantic": semantic_D,
        "temporal": temporal_D,
        "graph": graph_D,
        "tags": tag_D,
    }

    for dim_name, matrix in dim_matrices.items():
        pos_distances = []
        neg_distances = []

        for note_a, note_b in positive_pairs:
            if note_a in note_id_to_index and note_b in note_id_to_index:
                i = note_id_to_index[note_a]
                j = note_id_to_index[note_b]
                pos_distances.append(matrix[i, j])

        for note_a, note_b in negative_pairs:
            if note_a in note_id_to_index and note_b in note_id_to_index:
                i = note_id_to_index[note_a]
                j = note_id_to_index[note_b]
                neg_distances.append(matrix[i, j])

        if pos_distances:
            avg_pos_dist = np.mean(pos_distances)
            # If positive pairs are far in this dimension, reduce weight
            if avg_pos_dist > 0.5:
                weights[dim_name] *= (1 - learning_rate)

        if neg_distances:
            avg_neg_dist = np.mean(neg_distances)
            # If negative pairs are close in this dimension, reduce weight
            if avg_neg_dist < 0.3:
                weights[dim_name] *= (1 - learning_rate)

    # Renormalize to sum to 1.0
    total = sum(weights.values())
    if total > 0:
        weights = {k: v / total for k, v in weights.items()}

    return weights

def apply_pairwise_constraints(
    distance_matrix: np.ndarray,
    positive_pairs: set[tuple[str, str]],
    negative_pairs: set[tuple[str, str]],
    note_id_to_index: dict[str, int],
    alpha: float = 0.3,
) -> np.ndarray:
    """
    Apply must-link and cannot-link constraints to distance matrix.
    Positive pairs: reduce distance
    Negative pairs: increase distance
    """
    adjusted_D = distance_matrix.copy()

    for note_a, note_b in positive_pairs:
        if note_a in note_id_to_index and note_b in note_id_to_index:
            i = note_id_to_index[note_a]
            j = note_id_to_index[note_b]
            adjusted_D[i, j] *= (1 - alpha)
            adjusted_D[j, i] *= (1 - alpha)

    for note_a, note_b in negative_pairs:
        if note_a in note_id_to_index and note_b in note_id_to_index:
            i = note_id_to_index[note_a]
            j = note_id_to_index[note_b]
            adjusted_D[i, j] = min(1.0, adjusted_D[i, j] * (1 + alpha))
            adjusted_D[j, i] = min(1.0, adjusted_D[j, i] * (1 + alpha))

    return adjusted_D

def learn_cluster_naming(
    rename_examples: list[tuple[str, str, str]],
    texts: list[str],
    note_ids: list[str],
    cluster_labels: np.ndarray,
) -> dict[int, str]:
    """
    Learn better cluster names from rename examples.
    For now, simple heuristic: prefer words from user renames.
    Future: train a seq2seq model.
    """
    # Extract keywords from user-provided names
    rename_keywords = defaultdict(list)
    for cluster_id, original, new_name in rename_examples:
        words = new_name.lower().split()
        for word in words:
            if len(word) > 2:  # Skip short words
                rename_keywords[word].append(1)

    # Boost these words in TF-IDF
    # This is a placeholder - full implementation would modify extract_cluster_names
    return {}  # Return empty for now, integrate in Task 8
```

- [ ] **Step 2: Integrate learning into `pipeline.py`**

In `scripts/moc_pipeline/pipeline.py`:
```python
# Add import
from learning import (
    adjust_distance_weights,
    apply_pairwise_constraints,
)

# After building distance matrices, apply learning:
print("Applying feedback learning...")

note_id_to_index = {note_id: i for i, note_id in enumerate(note_ids)}

# Adjust weights based on feedback
if feedback:
    weights = adjust_distance_weights(
        positive_pairs,
        negative_pairs,
        note_id_to_index,
        semantic_D,
        temporal_D,
        graph_D,
        tag_D,
        {
            "semantic": WEIGHT_SEMANTIC,
            "temporal": WEIGHT_TEMPORAL,
            "graph": WEIGHT_GRAPH,
            "tags": WEIGHT_TAGS,
        },
    )
    print(f"Adjusted weights: {weights}")
    composite_D = (
        weights["semantic"] * semantic_D
        + weights["temporal"] * temporal_D
        + weights["graph"] * graph_D
        + weights["tags"] * tag_D
    )

    # Apply pairwise constraints
    composite_D = apply_pairwise_constraints(
        composite_D,
        positive_pairs,
        negative_pairs,
        note_id_to_index,
    )
else:
    composite_D = (
        WEIGHT_SEMANTIC * semantic_D
        + WEIGHT_TEMPORAL * temporal_D
        + WEIGHT_GRAPH * graph_D
        + WEIGHT_TAGS * tag_D
    )
```

- [ ] **Step 3: Commit**

```bash
git add scripts/moc_pipeline/learning.py \
        scripts/moc_pipeline/pipeline.py
git commit -m "feat: add learning algorithms for feedback-based clustering"
```

---

## Task 8: Update GitHub Workflow to Commit Feedback

**Files:**
- Modify: `docs/notes-repo-setup/moc-pipeline.yml`

- [ ] **Step 1: Add feedback file to commit**

In `docs/notes-repo-setup/moc-pipeline.yml`:
```yaml
- name: Commit results
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add .moc_cache .moc_clusters.json .moc_feedback.json
    if git diff --staged --quiet; then
      echo "No changes to commit"
    else
      git commit -m "chore(moc): update clusters and feedback [skip ci]"
      git push
    fi
```

Note: This assumes the app has already exported `.moc_feedback.json` before the pipeline runs. In practice, you may need a separate workflow or manual commit for feedback.

- [ ] **Step 2: Commit**

```bash
git add docs/notes-repo-setup/moc-pipeline.yml
git commit -m "chore: include feedback file in MOC pipeline commit"
```

---

## Task 9: Add Feedback Export to Git Sync

**Files:**
- Modify: `src/services/git/gitService.ts` (or appropriate git sync service)

- [ ] **Step 1: Export feedback before git commits**

Find where git commits are triggered (likely in `gitService.ts`) and add:
```typescript
import { exportFeedbackToFile } from "@/services/notes/clusterFeedbackService";

// Before committing, export feedback
await exportFeedbackToFile();
```

- [ ] **Step 2: Commit**

```bash
git add src/services/git/gitService.ts
git commit -m "feat: export feedback before git commits"
```

---

## Task 10: Testing and Validation

**Files:**
- Create: `scripts/moc_pipeline/tests/test_feedback.py`
- Create: `scripts/moc_pipeline/tests/test_learning.py`

- [ ] **Step 1: Write feedback tests**

Create `scripts/moc_pipeline/tests/test_feedback.py`:
```python
import pytest
from pathlib import Path
from feedback import load_feedback, get_positive_pairs, get_negative_pairs

def test_load_feedback_missing_file(tmp_path: Path):
    feedback = load_feedback(tmp_path)
    assert feedback == []

def test_load_feedback_valid_file(tmp_path: Path):
    feedback_path = tmp_path / ".moc_feedback.json"
    feedback_path.write_text('{"version": 1, "events": []}')
    feedback = load_feedback(tmp_path)
    assert feedback == []

def test_positive_pairs_from_accept():
    from feedback import FeedbackEvent
    feedback = [
        FeedbackEvent(
            cluster_id="test",
            event_type="accept",
            event_data={"memberIds": ["a", "b", "c"]},
            created_at=0,
        )
    ]
    pairs = get_positive_pairs(feedback)
    assert ("a", "b") in pairs
    assert ("b", "c") in pairs
    assert ("a", "c") in pairs
```

- [ ] **Step 2: Write learning tests**

Create `scripts/moc_pipeline/tests/test_learning.py`:
```python
import numpy as np
from learning import adjust_distance_weights, apply_pairwise_constraints

def test_adjust_distance_weights():
    note_id_to_index = {"a": 0, "b": 1}
    semantic_D = np.array([[0, 0.8], [0.8, 0]])
    temporal_D = np.array([[0, 0.2], [0.2, 0]])
    graph_D = np.array([[0, 0.5], [0.5, 0]])
    tag_D = np.array([[0, 0.3], [0.3, 0]])

    positive_pairs = {("a", "b")}  # High semantic distance, should reduce semantic weight

    weights = adjust_distance_weights(
        positive_pairs,
        set(),
        note_id_to_index,
        semantic_D,
        temporal_D,
        graph_D,
        tag_D,
        {"semantic": 0.5, "temporal": 0.2, "graph": 0.2, "tags": 0.1},
    )

    assert weights["semantic"] < 0.5  # Should be reduced
    assert abs(sum(weights.values()) - 1.0) < 0.01  # Should sum to 1

def test_apply_pairwise_constraints():
    D = np.array([[0, 0.5], [0.5, 0]])
    note_id_to_index = {"a": 0, "b": 1}

    adjusted = apply_pairwise_constraints(
        D,
        {("a", "b")},  # Positive pair
        set(),
        note_id_to_index,
        alpha=0.3,
    )

    assert adjusted[0, 1] < 0.5  # Distance reduced
```

- [ ] **Step 3: Run tests**

```bash
cd scripts/moc_pipeline
python -m pytest tests/test_feedback.py tests/test_learning.py -v
```

- [ ] **Step 4: Commit**

```bash
git add scripts/moc_pipeline/tests/test_feedback.py \
        scripts/moc_pipeline/tests/test_learning.py
git commit -m "test: add feedback and learning module tests"
```

---

## Task 11: End-to-End Testing

- [ ] **Step 1: Manual testing flow**

1. Start the app and ensure migrations apply
2. Import clusters from `.moc_clusters.json`
3. Accept a cluster → verify feedback logged
4. Dismiss a cluster → verify feedback logged
5. Rename a cluster → verify feedback logged
6. Add note to accepted cluster → verify feedback logged
7. Remove note from cluster → verify feedback logged
8. Export feedback → verify `.moc_feedback.json` created
9. Run pipeline locally → verify feedback is loaded and applied
10. Check that new clusters reflect learning (e.g., dismissed patterns avoided)

- [ ] **Step 2: Update documentation**

Update `docs/notes-repo-setup/moc-pipeline.yml` with notes about feedback learning.

- [ ] **Step 3: Commit**

```bash
git add docs/notes-repo-setup/moc-pipeline.yml
git commit -m "docs: document MOC feedback learning workflow"
```

---

## Future Enhancements (Out of Scope)

1. **Cluster naming model**: Train a seq2seq model to generate better cluster names from rename examples
2. **Embedding fine-tuning**: Fine-tune the sentence-transformer model on positive/negative note pairs
3. **Active learning**: Suggest clusters that would be most informative to label
4. **Confidence calibration**: Adjust confidence scores based on historical accuracy
5. **Temporal decay**: Weight recent feedback more heavily than old feedback
6. **Per-user feedback**: Support multiple users with different preferences
7. **Explainable recommendations**: Show why a cluster was suggested (which features contributed)

---

## Summary

This plan adds a complete feedback loop to the MOC suggestion system:

1. **Data capture**: All user actions on clusters are logged with rich metadata
2. **Feedback export**: Feedback is exported to `.moc_feedback.json` and committed to git
3. **Learning algorithms**: The pipeline uses feedback to:
   - Adjust feature weights (semantic, temporal, graph, tags)
   - Apply pairwise constraints (must-link/cannot-link)
   - Learn from rename examples (future enhancement)
4. **Continuous improvement**: Each iteration of the pipeline produces better suggestions based on user feedback

The implementation is incremental and can be tested at each stage. The learning algorithms start simple (weight adjustment, pairwise constraints) and can be enhanced over time with more sophisticated ML techniques.
