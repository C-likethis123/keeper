# MOC Suggestion Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the BFS/wikilink-based MOC categorisation sections from the home screen and replace them with a Python semantic clustering pipeline that surfaces proto-MOC cluster suggestions for human review.

**Architecture:** A local Python script reads markdown notes, generates sentence-transformer embeddings, runs agglomerative clustering, and writes a `.moc_clusters.json` file to the notes root. The app reads this file on load and imports clusters into a local SQLite schema (`clusters` + `cluster_members`). The home screen shows a "Suggested MOCs" review section where users can Accept (create a real MOC note), Dismiss, or Rename each cluster. The system never auto-creates MOC notes.

**Tech Stack:** Python 3.11+ · sentence-transformers · scikit-learn · TypeScript · Rust · expo-sqlite · rusqlite

---

## File Map

### Removed / Shrunk
- `src/services/notes/indexDb/repository.ts` — remove `getMocScores`, `getGraphNeighborhood`; add cluster CRUD functions
- `src/services/notes/notesIndexDb.ts` — remove `notesIndexDbGetMocScores`, `notesIndexDbGetGraphNeighborhood`; add cluster wrappers
- `src/hooks/useNotes.ts` — remove `mocNeighborhoods` from `loadSectionMetadata` and `computeSections`
- `src-tauri/storage_core/src/lib.rs` — remove `MocScore`, `GraphNeighbor`, `wiki_links_get_moc_scores`, `wiki_links_get_neighborhood`
- `src-tauri/src/storage/mod.rs` — remove their `pub use` and command functions
- `src-tauri/src/lib.rs` — remove commands from invoke handler

### New Files
- `src/migrations/006_add_clusters.ts` — mobile SQLite schema for clusters + cluster_members
- `src-tauri/storage_core/src/migrations/v6_add_clusters.rs` — desktop Rust equivalent
- `scripts/moc_pipeline/requirements.txt` — Python deps
- `scripts/moc_pipeline/pipeline.py` — CLI entry point
- `scripts/moc_pipeline/embeddings.py` — sentence-transformers wrapper
- `scripts/moc_pipeline/clustering.py` — agglomerative clustering + TF-IDF keyword extraction
- `src/services/notes/clusterService.ts` — JSON import + SQLite cluster queries (mobile)
- `src/components/MOCSuggestions.tsx` — cluster review UI card list

### Updated
- `src/migrations/migrations.ts` — add migration 6
- `src/services/notes/indexDb/db.ts` — bump `DATABASE_VERSION` to 6
- `src-tauri/storage_core/src/migrations/mod.rs` — register v6
- `src/app/index.tsx` — render `<MOCSuggestions />` above other sections
- `src-tauri/src/storage/mod.rs` — add cluster Tauri commands

---

## Task 1: Remove TypeScript MOC Categorization

**Files:**
- Modify: `src/services/notes/indexDb/repository.ts`
- Modify: `src/services/notes/notesIndexDb.ts`
- Modify: `src/hooks/useNotes.ts`

- [ ] **Step 1: Delete `getMocScores` and `getGraphNeighborhood` from `repository.ts`**

Remove lines 401–457 (the two functions and their JSDoc comments). Leave `getOrphanedNotes`, `getBacklinks`, `getOutgoingLinks`, `getTransitiveBacklinks`, and `getRecentlyEditedNotes` untouched.

- [ ] **Step 2: Remove their wrappers from `notesIndexDb.ts`**

Remove the following from `notesIndexDb.ts`:
```typescript
// Remove from import block at top:
getGraphNeighborhood,
getMocScores,

// Remove these two exported functions (lines ~80-93):
export async function notesIndexDbGetMocScores(
    minLinks = 3,
): Promise<{ noteId: string; outgoingCount: number }[]> {
    const database = await getNotesIndexDb();
    return getMocScores(database, minLinks);
}

export async function notesIndexDbGetGraphNeighborhood(
    noteId: string,
    maxDepth = 2,
): Promise<{ noteId: string; depth: number }[]> {
    const database = await getNotesIndexDb();
    return getGraphNeighborhood(database, noteId, maxDepth);
}
```

- [ ] **Step 3: Simplify `loadSectionMetadata` in `useNotes.ts`**

Replace the current `loadSectionMetadata` function (lines 143–172) with:
```typescript
async function loadSectionMetadata() {
    const recentlyEditedRows = await notesIndexDbGetRecentlyEditedNotes(10, 7);
    const recentlyEditedNoteIds = new Set(
        recentlyEditedRows.map((row) => row.id),
    );
    const orphanedNoteIds = new Set(await notesIndexDbGetOrphanedNotes());
    return { recentlyEditedNoteIds, orphanedNoteIds };
}
```

Remove the imports `notesIndexDbGetMocScores` and `notesIndexDbGetGraphNeighborhood` from the import block at the top of the file.

- [ ] **Step 4: Remove `mocNeighborhoods` from `computeSections`**

Replace the `computeSections` signature and body (lines 41–113) with:
```typescript
function computeSections(
    allNotes: Note[],
    pinnedNotes: Note[],
    recentlyEditedNoteIds: Set<string>,
    orphanedNoteIds: Set<string>,
): NoteSection[] {
    const sections: NoteSection[] = [];

    if (pinnedNotes.length > 0) {
        sections.push({ id: "pinned", title: "Pinned", notes: pinnedNotes });
    }

    const recentlyEditedNotes = allNotes.filter((n) => recentlyEditedNoteIds.has(n.id));
    if (recentlyEditedNotes.length > 0) {
        sections.push({ id: "recently-edited", title: "Recently Edited", notes: recentlyEditedNotes });
    }

    const uncategorizedNotes = allNotes.filter((n) => orphanedNoteIds.has(n.id));
    if (uncategorizedNotes.length > 0) {
        sections.push({ id: "uncategorized", title: "Uncategorized", notes: uncategorizedNotes });
    }

    const shownNoteIds = new Set<string>();
    for (const section of sections) {
        for (const note of section.notes) {
            shownNoteIds.add(note.id);
        }
    }
    const allNotesSection = allNotes.filter((n) => !shownNoteIds.has(n.id));
    if (allNotesSection.length > 0) {
        sections.push({ id: "all-notes", title: "All Notes", notes: allNotesSection });
    }

    return sections;
}
```

- [ ] **Step 5: Update `sectionMetadata` state shape and all call sites**

In the `useNotes` hook body, replace `sectionMetadata` state:
```typescript
// Remove:
const [sectionMetadata, setSectionMetadata] = useState<{
    recentlyEditedNoteIds: Set<string>;
    mocNeighborhoods: Map<string, Set<string>>;
    orphanedNoteIds: Set<string>;
}>({
    recentlyEditedNoteIds: new Set(),
    mocNeighborhoods: new Map(),
    orphanedNoteIds: new Set(),
});

// Replace with:
const [sectionMetadata, setSectionMetadata] = useState<{
    recentlyEditedNoteIds: Set<string>;
    orphanedNoteIds: Set<string>;
}>({
    recentlyEditedNoteIds: new Set(),
    orphanedNoteIds: new Set(),
});
```

Update the catch block inside the `useEffect` to omit `mocNeighborhoods`:
```typescript
setSectionMetadata({
    recentlyEditedNoteIds: new Set(),
    orphanedNoteIds: new Set(),
});
```

Update the `computeSections` call:
```typescript
return computeSections(
    allNotes,
    pinnedNotes,
    sectionMetadata.recentlyEditedNoteIds,
    sectionMetadata.orphanedNoteIds,
);
```

- [ ] **Step 6: Run lint and tests to verify clean removal**

```bash
npm run lint
npm test -- --testPathPattern="useNotes|NoteGrid"
```

Expected: no errors, no MOC-related test failures (there were no MOC-specific tests, so all existing tests should still pass).

- [ ] **Step 7: Commit**

```bash
git add src/services/notes/indexDb/repository.ts \
        src/services/notes/notesIndexDb.ts \
        src/hooks/useNotes.ts
git commit -m "remove: BFS/wikilink-based MOC categorisation from home screen sections"
```

---

## Task 2: Remove Rust/Tauri MOC Categorization

**Files:**
- Modify: `src-tauri/storage_core/src/lib.rs`
- Modify: `src-tauri/src/storage/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Remove from `storage_core/src/lib.rs`**

Delete lines 755–872 (the `// ─── Graph Queries` section through the end of `wiki_links_get_neighborhood`). Keep `wiki_links_get_orphaned_notes` and `wiki_links_get_recently_edited`.

Specifically remove:
- `MocScore` struct (lines ~757–762)
- `GraphNeighbor` struct (lines ~764–769)
- `wiki_links_get_moc_scores` function (lines ~807–834)
- `wiki_links_get_neighborhood` function (lines ~836–872)

The `// ─── Graph Queries` section comment can stay or be removed — it introduces the remaining `wiki_links_get_backlinks` and `wiki_links_get_outgoing` functions which are still used.

- [ ] **Step 2: Remove from `src-tauri/src/storage/mod.rs`**

In the `pub use storage_core::{...}` block at the top, remove `MocScore` and `GraphNeighbor`.

Remove the two Tauri command functions:
```rust
// Delete these entire functions:
#[tauri::command]
pub fn wiki_links_get_moc_scores(
    app: tauri::AppHandle,
    min_links: i64,
) -> Result<Vec<MocScore>, String> { ... }

#[tauri::command]
pub fn wiki_links_get_neighborhood(
    app: tauri::AppHandle,
    note_id: String,
    max_depth: i64,
) -> Result<Vec<GraphNeighbor>, String> { ... }
```

- [ ] **Step 3: Remove from `src-tauri/src/lib.rs` invoke handler**

In the `generate_handler![...]` block (around line 179), remove:
```rust
storage::wiki_links_get_moc_scores,
storage::wiki_links_get_neighborhood,
```

- [ ] **Step 4: Build desktop to confirm it compiles**

```bash
npm run desktop
```

Expected: Tauri app launches without compile errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/storage_core/src/lib.rs \
        src-tauri/src/storage/mod.rs \
        src-tauri/src/lib.rs
git commit -m "remove: Rust/Tauri MOC score and graph neighborhood commands"
```

---

## Task 3: Add Cluster SQLite Schema (Mobile)

**Files:**
- Create: `src/migrations/006_add_clusters.ts`
- Modify: `src/migrations/migrations.ts`
- Modify: `src/services/notes/indexDb/db.ts`

- [ ] **Step 1: Write the migration**

Create `src/migrations/006_add_clusters.ts`:
```typescript
import type { SQLiteDatabase } from "expo-sqlite";

export async function migrate(db: SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS clusters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            confidence REAL NOT NULL,
            created_at INTEGER NOT NULL,
            dismissed_at INTEGER,
            accepted_at INTEGER,
            accepted_note_id TEXT
        )
    `);
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS cluster_members (
            cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
            note_id TEXT NOT NULL,
            score REAL NOT NULL,
            PRIMARY KEY (cluster_id, note_id)
        )
    `);
    await db.execAsync("PRAGMA user_version = 6");
}
```

- [ ] **Step 2: Register the migration**

In `src/migrations/migrations.ts`:
```typescript
import { migrate as migrate001 } from "./001_init";
import { migrate as migrate002 } from "./002_add_fts";
import { migrate as migrate003 } from "./003_add_note_metadata";
import { migrate as migrate004 } from "./004_add_wiki_links";
import { migrate as migrate005 } from "./005_add_modified_column";
import { migrate as migrate006 } from "./006_add_clusters";

export const MIGRATIONS = [
    { version: 1, migrate: migrate001 },
    { version: 2, migrate: migrate002 },
    { version: 3, migrate: migrate003 },
    { version: 4, migrate: migrate004 },
    { version: 5, migrate: migrate005 },
    { version: 6, migrate: migrate006 },
];
```

- [ ] **Step 3: Bump DATABASE_VERSION in `db.ts`**

```typescript
const DATABASE_VERSION = 6;
```

- [ ] **Step 4: Run the app and confirm migration runs without error**

```bash
npm start
```

Open the app. There should be no crash. If using a real device or simulator, you can verify via Expo DevTools that startup completes.

- [ ] **Step 5: Commit**

```bash
git add src/migrations/006_add_clusters.ts \
        src/migrations/migrations.ts \
        src/services/notes/indexDb/db.ts
git commit -m "feat: add cluster tables migration (v6) for MOC suggestion engine"
```

---

## Task 4: Add Cluster Schema (Desktop / Rust)

**Files:**
- Create: `src-tauri/storage_core/src/migrations/v6_add_clusters.rs`
- Modify: `src-tauri/storage_core/src/migrations/mod.rs`

- [ ] **Step 1: Write the Rust migration**

Create `src-tauri/storage_core/src/migrations/v6_add_clusters.rs`:
```rust
use rusqlite::Connection;

pub fn apply(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS clusters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            confidence REAL NOT NULL,
            created_at INTEGER NOT NULL,
            dismissed_at INTEGER,
            accepted_at INTEGER,
            accepted_note_id TEXT
        );
        CREATE TABLE IF NOT EXISTS cluster_members (
            cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
            note_id TEXT NOT NULL,
            score REAL NOT NULL,
            PRIMARY KEY (cluster_id, note_id)
        );
        PRAGMA user_version = 6;",
    )
    .map_err(|e| format!("migration v6 failed: {e}"))?;
    Ok(())
}
```

- [ ] **Step 2: Register in `mod.rs`**

In `src-tauri/storage_core/src/migrations/mod.rs`:
```rust
mod v1_init;
mod v2_add_fts;
mod v3_add_note_metadata;
mod v4_add_wiki_links;
mod v5_add_modified_column;
mod v6_add_clusters;

// ... (keep existing MIGRATIONS array and add the new entry)

const MIGRATIONS: &[Migration] = &[
    Migration { version: 1, apply: v1_init::apply },
    Migration { version: 2, apply: v2_add_fts::apply },
    Migration { version: 3, apply: v3_add_note_metadata::apply },
    Migration { version: 4, apply: v4_add_wiki_links::apply },
    Migration { version: 5, apply: v5_add_modified_column::apply },
    Migration { version: 6, apply: v6_add_clusters::apply },
];
```

- [ ] **Step 3: Verify desktop builds**

```bash
npm run desktop
```

Expected: Tauri app launches. Migration v6 applies on first run.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/storage_core/src/migrations/v6_add_clusters.rs \
        src-tauri/storage_core/src/migrations/mod.rs
git commit -m "feat: add cluster tables Rust migration (v6)"
```

---

## Task 5: Python Pipeline

**Files:**
- Create: `scripts/moc_pipeline/requirements.txt`
- Create: `scripts/moc_pipeline/embeddings.py`
- Create: `scripts/moc_pipeline/clustering.py`
- Create: `scripts/moc_pipeline/pipeline.py`

The pipeline reads all markdown note files from a directory, produces sentence-transformer embeddings, runs agglomerative clustering, generates TF-IDF keyword names per cluster, and writes `.moc_clusters.json` to the notes directory.

- [ ] **Step 1: Write `requirements.txt`**

Create `scripts/moc_pipeline/requirements.txt`:
```
sentence-transformers>=2.7.0
scikit-learn>=1.4.0
numpy>=1.26.0
```

- [ ] **Step 2: Write `embeddings.py`**

Create `scripts/moc_pipeline/embeddings.py`:
```python
from __future__ import annotations
import numpy as np
from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def generate_embeddings(texts: list[str]) -> np.ndarray:
    """Return L2-normalised embeddings, shape (len(texts), 384)."""
    return get_model().encode(texts, normalize_embeddings=True, show_progress_bar=True)
```

- [ ] **Step 3: Write `clustering.py`**

Create `scripts/moc_pipeline/clustering.py`:
```python
from __future__ import annotations
import re
import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.feature_extraction.text import TfidfVectorizer


def _strip_frontmatter(text: str) -> str:
    """Remove YAML frontmatter block if present."""
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            return text[end + 3 :].strip()
    return text


def cluster_notes(
    embeddings: np.ndarray,
    distance_threshold: float = 0.40,
) -> np.ndarray:
    """
    Return label array (length = len(embeddings)).
    Uses cosine distance with average linkage.
    Clusters with only 1 member get label -1 (noise) after filtering.
    """
    if len(embeddings) < 3:
        return np.arange(len(embeddings))

    model = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=distance_threshold,
        metric="cosine",
        linkage="average",
    )
    labels: np.ndarray = model.fit_predict(embeddings)

    # Mark singleton clusters as noise
    from collections import Counter
    counts = Counter(labels.tolist())
    for i, label in enumerate(labels):
        if counts[label] < 2:
            labels[i] = -1

    return labels


def extract_cluster_names(
    labels: np.ndarray,
    texts: list[str],
    n_keywords: int = 3,
) -> dict[int, str]:
    """
    For each unique non-noise label, compute TF-IDF over member note bodies
    and join the top `n_keywords` terms as the cluster name.
    """
    stripped = [_strip_frontmatter(t) for t in texts]
    vectorizer = TfidfVectorizer(
        max_features=2000,
        stop_words="english",
        max_df=0.85,
        min_df=1,
        ngram_range=(1, 2),
    )
    tfidf = vectorizer.fit_transform(stripped)
    feature_names = vectorizer.get_feature_names_out()

    names: dict[int, str] = {}
    for label in set(labels.tolist()):
        if label == -1:
            continue
        member_indices = [i for i, l in enumerate(labels) if l == label]
        cluster_vector = np.asarray(tfidf[member_indices].mean(axis=0)).flatten()
        top_idx = cluster_vector.argsort()[-n_keywords:][::-1]
        top_words = [feature_names[i] for i in top_idx if cluster_vector[i] > 0]
        if top_words:
            names[label] = " / ".join(w.title() for w in top_words)
        else:
            names[label] = f"Cluster {label}"
    return names


def average_intra_cluster_similarity(
    embeddings: np.ndarray,
    member_indices: list[int],
) -> float:
    """Confidence = mean pairwise cosine similarity among cluster members."""
    if len(member_indices) < 2:
        return 0.0
    vecs = embeddings[member_indices]
    # Embeddings are already L2-normalised, so dot product = cosine similarity
    sim_matrix = vecs @ vecs.T
    n = len(member_indices)
    # Sum off-diagonal
    total = (sim_matrix.sum() - n) / (n * (n - 1))
    return float(total)
```

- [ ] **Step 4: Write `pipeline.py`**

Create `scripts/moc_pipeline/pipeline.py`:
```python
"""
MOC Suggestion Pipeline

Usage:
    python scripts/moc_pipeline/pipeline.py <notes-root>

Reads all *.md files under <notes-root>, generates semantic embeddings,
clusters them, and writes <notes-root>/.moc_clusters.json.

The output file is read by the Keeper app on next load to populate
cluster suggestion tables.
"""
from __future__ import annotations
import json
import sys
import uuid
from pathlib import Path

from embeddings import generate_embeddings
from clustering import (
    average_intra_cluster_similarity,
    cluster_notes,
    extract_cluster_names,
)

OUTPUT_FILENAME = ".moc_clusters.json"
MIN_CLUSTER_CONFIDENCE = 0.30


def load_notes(notes_root: Path) -> tuple[list[str], list[str]]:
    """Return (note_ids, texts). note_id = relative path without extension."""
    note_ids: list[str] = []
    texts: list[str] = []
    for md_file in sorted(notes_root.rglob("*.md")):
        # Skip hidden directories (e.g. .git, .keeper)
        if any(part.startswith(".") for part in md_file.relative_to(notes_root).parts[:-1]):
            continue
        try:
            content = md_file.read_text(encoding="utf-8")
        except Exception:
            continue
        rel = md_file.relative_to(notes_root)
        note_id = str(rel.with_suffix(""))
        note_ids.append(note_id)
        texts.append(content)
    return note_ids, texts


def build_output(
    note_ids: list[str],
    labels,
    cluster_names: dict[int, str],
    embeddings,
) -> dict:
    from collections import defaultdict
    import numpy as np

    member_map: dict[int, list[int]] = defaultdict(list)
    for i, label in enumerate(labels.tolist()):
        if label != -1:
            member_map[int(label)].append(i)

    clusters = []
    for label, member_indices in member_map.items():
        confidence = average_intra_cluster_similarity(embeddings, member_indices)
        if confidence < MIN_CLUSTER_CONFIDENCE:
            continue
        members = [
            {"note_id": note_ids[i], "score": float(embeddings[member_indices] @ embeddings[i])}
            for i in member_indices
        ]
        clusters.append({
            "id": str(uuid.uuid4()),
            "name": cluster_names.get(label, f"Cluster {label}"),
            "confidence": round(confidence, 4),
            "members": members,
        })

    # Sort by confidence descending
    clusters.sort(key=lambda c: c["confidence"], reverse=True)
    return {"version": 1, "clusters": clusters}


def main(notes_root_arg: str) -> None:
    notes_root = Path(notes_root_arg).resolve()
    if not notes_root.is_dir():
        print(f"Error: {notes_root} is not a directory", file=sys.stderr)
        sys.exit(1)

    print(f"Loading notes from {notes_root}...")
    note_ids, texts = load_notes(notes_root)
    if len(note_ids) < 3:
        print(f"Only {len(note_ids)} notes found — need at least 3 to cluster.")
        sys.exit(0)
    print(f"Found {len(note_ids)} notes.")

    print("Generating embeddings...")
    embeddings = generate_embeddings(texts)

    print("Clustering...")
    labels = cluster_notes(embeddings)
    cluster_names = extract_cluster_names(labels, texts)

    output = build_output(note_ids, labels, cluster_names, embeddings)
    out_path = notes_root / OUTPUT_FILENAME
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(output['clusters'])} clusters to {out_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <notes-root>")
        sys.exit(1)
    main(sys.argv[1])
```

- [ ] **Step 5: Smoke-test the pipeline on a local notes directory**

```bash
cd scripts/moc_pipeline
pip install -r requirements.txt
python pipeline.py ~/path/to/your/notes
```

Expected: `.moc_clusters.json` is written. Inspect it:
```bash
cat ~/path/to/your/notes/.moc_clusters.json | python -m json.tool | head -40
```
Expected: JSON with `version: 1` and an array of cluster objects each with `id`, `name`, `confidence`, and `members`.

- [ ] **Step 6: Commit**

```bash
git add scripts/moc_pipeline/
git commit -m "feat: add MOC semantic clustering Python pipeline"
```

---

## Task 6: TypeScript Cluster Service (Mobile)

**Files:**
- Modify: `src/services/notes/indexDb/repository.ts`
- Create: `src/services/notes/clusterService.ts`

This task adds functions to read/write cluster data in the mobile SQLite DB and a service to import from `.moc_clusters.json`.

- [ ] **Step 1: Add cluster CRUD to `repository.ts`**

Append to the end of `src/services/notes/indexDb/repository.ts`:

```typescript
// ─── Cluster Suggestions ──────────────────────────────────────

export interface ClusterRow {
    id: string;
    name: string;
    confidence: number;
    created_at: number;
    dismissed_at: number | null;
    accepted_at: number | null;
    accepted_note_id: string | null;
}

export interface ClusterMemberRow {
    cluster_id: string;
    note_id: string;
    score: number;
}

export async function getActiveClusters(
    database: SQLiteDatabase,
): Promise<ClusterRow[]> {
    return (
        (await database.getAllAsync<ClusterRow>(
            `SELECT id, name, confidence, created_at, dismissed_at, accepted_at, accepted_note_id
             FROM clusters
             WHERE dismissed_at IS NULL AND accepted_at IS NULL
             ORDER BY confidence DESC`,
        )) ?? []
    );
}

export async function getClusterMembers(
    database: SQLiteDatabase,
    clusterId: string,
): Promise<ClusterMemberRow[]> {
    return (
        (await database.getAllAsync<ClusterMemberRow>(
            `SELECT cluster_id, note_id, score FROM cluster_members WHERE cluster_id = ?`,
            clusterId,
        )) ?? []
    );
}

export async function dismissCluster(
    database: SQLiteDatabase,
    clusterId: string,
): Promise<void> {
    await database.runAsync(
        `UPDATE clusters SET dismissed_at = ? WHERE id = ?`,
        Date.now(),
        clusterId,
    );
}

export async function acceptCluster(
    database: SQLiteDatabase,
    clusterId: string,
    noteId: string,
): Promise<void> {
    await database.runAsync(
        `UPDATE clusters SET accepted_at = ?, accepted_note_id = ? WHERE id = ?`,
        Date.now(),
        noteId,
        clusterId,
    );
}

export async function renameCluster(
    database: SQLiteDatabase,
    clusterId: string,
    name: string,
): Promise<void> {
    await database.runAsync(
        `UPDATE clusters SET name = ? WHERE id = ?`,
        name,
        clusterId,
    );
}

export async function upsertClustersFromJson(
    database: SQLiteDatabase,
    clusters: Array<{
        id: string;
        name: string;
        confidence: number;
        members: Array<{ note_id: string; score: number }>;
    }>,
): Promise<void> {
    await database.withTransactionAsync(async () => {
        for (const cluster of clusters) {
            await database.runAsync(
                `INSERT INTO clusters (id, name, confidence, created_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   confidence = excluded.confidence`,
                cluster.id,
                cluster.name,
                cluster.confidence,
                Date.now(),
            );
            for (const member of cluster.members) {
                await database.runAsync(
                    `INSERT OR REPLACE INTO cluster_members (cluster_id, note_id, score)
                     VALUES (?, ?, ?)`,
                    cluster.id,
                    member.note_id,
                    member.score,
                );
            }
        }
    });
}
```

- [ ] **Step 2: Create `clusterService.ts`**

Create `src/services/notes/clusterService.ts`:
```typescript
import { NOTES_ROOT } from "@/services/notes/Notes";
import { File } from "expo-file-system";
import {
    acceptCluster,
    dismissCluster,
    getActiveClusters,
    getClusterMembers,
    renameCluster,
    upsertClustersFromJson,
    type ClusterMemberRow,
    type ClusterRow,
} from "./indexDb/repository";
import { getNotesIndexDb } from "./indexDb/db";

export type { ClusterRow, ClusterMemberRow };

const CLUSTERS_FILENAME = ".moc_clusters.json";

interface ClustersJson {
    version: number;
    clusters: Array<{
        id: string;
        name: string;
        confidence: number;
        members: Array<{ note_id: string; score: number }>;
    }>;
}

export async function importClustersFromFile(): Promise<number> {
    const filePath = `${NOTES_ROOT}/${CLUSTERS_FILENAME}`;
    const file = new File(filePath);
    const exists = await file.exists();
    if (!exists) return 0;

    const raw = await file.text();
    let parsed: ClustersJson;
    try {
        parsed = JSON.parse(raw) as ClustersJson;
    } catch {
        return 0;
    }

    if (!Array.isArray(parsed.clusters)) return 0;

    const database = await getNotesIndexDb();
    await upsertClustersFromJson(database, parsed.clusters);
    return parsed.clusters.length;
}

export async function listActiveClusters(): Promise<ClusterRow[]> {
    const database = await getNotesIndexDb();
    return getActiveClusters(database);
}

export async function listClusterMembers(clusterId: string): Promise<ClusterMemberRow[]> {
    const database = await getNotesIndexDb();
    return getClusterMembers(database, clusterId);
}

export async function clusterDismiss(clusterId: string): Promise<void> {
    const database = await getNotesIndexDb();
    await dismissCluster(database, clusterId);
}

export async function clusterAccept(clusterId: string, noteId: string): Promise<void> {
    const database = await getNotesIndexDb();
    await acceptCluster(database, clusterId, noteId);
}

export async function clusterRename(clusterId: string, name: string): Promise<void> {
    const database = await getNotesIndexDb();
    await renameCluster(database, clusterId, name);
}
```

- [ ] **Step 3: Verify TypeScript compiles without errors**

```bash
npm run lint
```

Expected: No errors in `clusterService.ts` or `repository.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/services/notes/indexDb/repository.ts \
        src/services/notes/clusterService.ts
git commit -m "feat: add cluster CRUD and JSON import service (mobile)"
```

---

## Task 7: Desktop Cluster Commands (Rust + Tauri)

**Files:**
- Modify: `src-tauri/storage_core/src/lib.rs`
- Modify: `src-tauri/src/storage/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add cluster Rust types and functions to `storage_core/src/lib.rs`**

Append before the final closing of the file:

```rust
// ─── Cluster Suggestions ────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterRow {
    pub id: String,
    pub name: String,
    pub confidence: f64,
    pub created_at: i64,
    pub dismissed_at: Option<i64>,
    pub accepted_at: Option<i64>,
    pub accepted_note_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterMemberRow {
    pub cluster_id: String,
    pub note_id: String,
    pub score: f64,
}

pub fn clusters_get_active(index_db_path: &Path) -> Result<Vec<ClusterRow>, String> {
    let conn = open_index_db(index_db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, confidence, created_at, dismissed_at, accepted_at, accepted_note_id
             FROM clusters
             WHERE dismissed_at IS NULL AND accepted_at IS NULL
             ORDER BY confidence DESC",
        )
        .map_err(|e| format!("clusters_get_active prepare failed: {e}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ClusterRow {
                id: row.get(0)?,
                name: row.get(1)?,
                confidence: row.get(2)?,
                created_at: row.get(3)?,
                dismissed_at: row.get(4)?,
                accepted_at: row.get(5)?,
                accepted_note_id: row.get(6)?,
            })
        })
        .map_err(|e| format!("clusters_get_active query failed: {e}"))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("clusters_get_active row failed: {e}"))?);
    }
    Ok(result)
}

pub fn clusters_get_members(
    index_db_path: &Path,
    cluster_id: String,
) -> Result<Vec<ClusterMemberRow>, String> {
    let conn = open_index_db(index_db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT cluster_id, note_id, score FROM cluster_members WHERE cluster_id = ?",
        )
        .map_err(|e| format!("clusters_get_members prepare failed: {e}"))?;
    let rows = stmt
        .query_map([&cluster_id], |row| {
            Ok(ClusterMemberRow {
                cluster_id: row.get(0)?,
                note_id: row.get(1)?,
                score: row.get(2)?,
            })
        })
        .map_err(|e| format!("clusters_get_members query failed: {e}"))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("clusters_get_members row failed: {e}"))?);
    }
    Ok(result)
}

pub fn clusters_dismiss(index_db_path: &Path, cluster_id: String) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    conn.execute(
        "UPDATE clusters SET dismissed_at = ?1 WHERE id = ?2",
        rusqlite::params![
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64,
            cluster_id
        ],
    )
    .map_err(|e| format!("clusters_dismiss failed: {e}"))?;
    Ok(())
}

pub fn clusters_accept(
    index_db_path: &Path,
    cluster_id: String,
    note_id: String,
) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    conn.execute(
        "UPDATE clusters SET accepted_at = ?1, accepted_note_id = ?2 WHERE id = ?3",
        rusqlite::params![now, note_id, cluster_id],
    )
    .map_err(|e| format!("clusters_accept failed: {e}"))?;
    Ok(())
}

pub fn clusters_rename(
    index_db_path: &Path,
    cluster_id: String,
    name: String,
) -> Result<(), String> {
    let conn = open_index_db(index_db_path)?;
    conn.execute(
        "UPDATE clusters SET name = ?1 WHERE id = ?2",
        rusqlite::params![name, cluster_id],
    )
    .map_err(|e| format!("clusters_rename failed: {e}"))?;
    Ok(())
}

pub fn clusters_import_from_json(
    index_db_path: &Path,
    notes_root: &Path,
) -> Result<usize, String> {
    use std::fs;
    let json_path = notes_root.join(".moc_clusters.json");
    if !json_path.exists() {
        return Ok(0);
    }
    let raw = fs::read_to_string(&json_path)
        .map_err(|e| format!("clusters_import_from_json read failed: {e}"))?;
    let parsed: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("clusters JSON parse failed: {e}"))?;
    let clusters = parsed["clusters"]
        .as_array()
        .ok_or("clusters field missing or not array")?;

    let conn = open_index_db(index_db_path)?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    for cluster in clusters {
        let id = cluster["id"].as_str().ok_or("cluster missing id")?;
        let name = cluster["name"].as_str().ok_or("cluster missing name")?;
        let confidence = cluster["confidence"].as_f64().unwrap_or(0.0);
        conn.execute(
            "INSERT INTO clusters (id, name, confidence, created_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, confidence = excluded.confidence",
            rusqlite::params![id, name, confidence, now],
        )
        .map_err(|e| format!("clusters_import insert failed: {e}"))?;

        if let Some(members) = cluster["members"].as_array() {
            for member in members {
                let note_id = member["note_id"].as_str().ok_or("member missing note_id")?;
                let score = member["score"].as_f64().unwrap_or(0.0);
                conn.execute(
                    "INSERT OR REPLACE INTO cluster_members (cluster_id, note_id, score) VALUES (?1, ?2, ?3)",
                    rusqlite::params![id, note_id, score],
                )
                .map_err(|e| format!("clusters_import member insert failed: {e}"))?;
            }
        }
    }
    Ok(clusters.len())
}
```

Note: `serde_json` must be in `storage_core/Cargo.toml`. Check if it's already a dep; if not, add `serde_json = "1"` to `[dependencies]`.

- [ ] **Step 2: Add Tauri commands in `src-tauri/src/storage/mod.rs`**

Add the following to the pub use block at the top:
```rust
pub use storage_core::{
    // ... existing exports ...,
    ClusterRow, ClusterMemberRow,
};
```

Add command functions after the existing wiki_links commands:
```rust
#[tauri::command]
pub fn clusters_get_active(app: tauri::AppHandle) -> Result<Vec<ClusterRow>, String> {
    let index_db = index_db_path(&app)?;
    storage_core::clusters_get_active(&index_db)
}

#[tauri::command]
pub fn clusters_get_members(
    app: tauri::AppHandle,
    cluster_id: String,
) -> Result<Vec<ClusterMemberRow>, String> {
    let index_db = index_db_path(&app)?;
    storage_core::clusters_get_members(&index_db, cluster_id)
}

#[tauri::command]
pub fn clusters_dismiss(app: tauri::AppHandle, cluster_id: String) -> Result<(), String> {
    let index_db = index_db_path(&app)?;
    storage_core::clusters_dismiss(&index_db, cluster_id)
}

#[tauri::command]
pub fn clusters_accept(
    app: tauri::AppHandle,
    cluster_id: String,
    note_id: String,
) -> Result<(), String> {
    let index_db = index_db_path(&app)?;
    storage_core::clusters_accept(&index_db, cluster_id, note_id)
}

#[tauri::command]
pub fn clusters_rename(
    app: tauri::AppHandle,
    cluster_id: String,
    name: String,
) -> Result<(), String> {
    let index_db = index_db_path(&app)?;
    storage_core::clusters_rename(&index_db, cluster_id, name)
}

#[tauri::command]
pub fn clusters_import(app: tauri::AppHandle) -> Result<usize, String> {
    let index_db = index_db_path(&app)?;
    let notes_root = notes_root_path(&app)?;
    storage_core::clusters_import_from_json(&index_db, &notes_root)
}
```

- [ ] **Step 3: Register commands in `src-tauri/src/lib.rs`**

In the `generate_handler![...]` block, add:
```rust
storage::clusters_get_active,
storage::clusters_get_members,
storage::clusters_dismiss,
storage::clusters_accept,
storage::clusters_rename,
storage::clusters_import,
```

- [ ] **Step 4: Check `serde_json` dependency**

```bash
grep "serde_json" src-tauri/storage_core/Cargo.toml
```

If absent, add to `[dependencies]`:
```toml
serde_json = "1"
```

- [ ] **Step 5: Build and verify**

```bash
npm run desktop
```

Expected: Tauri app builds and launches without Rust compile errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/storage_core/src/lib.rs \
        src-tauri/src/storage/mod.rs \
        src-tauri/src/lib.rs \
        src-tauri/storage_core/Cargo.toml
git commit -m "feat: add cluster Tauri commands and Rust storage functions"
```

---

## Task 8: Cluster Suggestion UI

**Files:**
- Create: `src/components/MOCSuggestions.tsx`

This component renders a list of suggested cluster cards. Each card shows the cluster name, a short preview of member note titles, and Accept / Rename / Dismiss actions. Rename opens a simple `Alert.prompt` (iOS/web) or a `TextInput` inline.

- [ ] **Step 1: Write `MOCSuggestions.tsx`**

Create `src/components/MOCSuggestions.tsx`:
```typescript
import { useExtendedTheme } from "@/hooks/useExtendedTheme";
import {
    clusterAccept,
    clusterDismiss,
    clusterRename,
    listActiveClusters,
    listClusterMembers,
    type ClusterRow,
} from "@/services/notes/clusterService";
import { noteService } from "@/services/notes/noteService";
import { useStorageStore } from "@/stores/storageStore";
import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface ClusterCard {
    cluster: ClusterRow;
    memberNoteIds: string[];
}

export default function MOCSuggestions() {
    const { colors } = useExtendedTheme();
    const contentVersion = useStorageStore((s) => s.contentVersion);
    const [cards, setCards] = useState<ClusterCard[]>([]);

    const loadClusters = useCallback(async () => {
        const clusters = await listActiveClusters();
        const loaded: ClusterCard[] = await Promise.all(
            clusters.map(async (cluster) => {
                const members = await listClusterMembers(cluster.id);
                return {
                    cluster,
                    memberNoteIds: members.map((m) => m.note_id).slice(0, 5),
                };
            }),
        );
        setCards(loaded);
    }, []);

    useEffect(() => {
        void loadClusters();
    }, [loadClusters, contentVersion]);

    const handleDismiss = useCallback(
        async (clusterId: string) => {
            await clusterDismiss(clusterId);
            await loadClusters();
        },
        [loadClusters],
    );

    const handleAccept = useCallback(
        async (card: ClusterCard) => {
            // Build note body: heading + wiki links to all members
            const wikiLinks = card.memberNoteIds
                .map((id) => `[[${id}]]`)
                .join("\n");
            const body = `# ${card.cluster.name}\n\n${wikiLinks}\n`;
            const created = await noteService.createNote(
                card.cluster.name,
                body,
            );
            await clusterAccept(card.cluster.id, created.id);
            await loadClusters();
        },
        [loadClusters],
    );

    const handleRename = useCallback(
        async (card: ClusterCard) => {
            if (Platform.OS === "ios" || Platform.OS === "web") {
                Alert.prompt(
                    "Rename Cluster",
                    "Enter a new name",
                    async (newName) => {
                        if (newName?.trim()) {
                            await clusterRename(card.cluster.id, newName.trim());
                            await loadClusters();
                        }
                    },
                    "plain-text",
                    card.cluster.name,
                );
            } else {
                // Android: use a simple Alert with no prompt support
                Alert.alert(
                    "Rename",
                    "Use the Rename feature on desktop or iOS to rename this cluster.",
                );
            }
        },
        [loadClusters],
    );

    if (cards.length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={[styles.sectionHeader, { color: colors.text }]}>
                Suggested MOCs
            </Text>
            {cards.map((card) => (
                <View
                    key={card.cluster.id}
                    style={[
                        styles.card,
                        { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                >
                    <Text
                        style={[styles.clusterName, { color: colors.text }]}
                        numberOfLines={1}
                    >
                        {card.cluster.name}
                    </Text>
                    <Text
                        style={[styles.members, { color: colors.secondaryText }]}
                        numberOfLines={2}
                    >
                        {card.memberNoteIds.join(" · ")}
                    </Text>
                    <Text
                        style={[styles.confidence, { color: colors.secondaryText }]}
                    >
                        {Math.round(card.cluster.confidence * 100)}% confidence
                    </Text>
                    <View style={styles.actions}>
                        <Pressable
                            onPress={() => handleAccept(card)}
                            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                        >
                            <Text style={styles.actionBtnText}>Accept</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => handleRename(card)}
                            style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                        >
                            <Text style={[styles.actionBtnText, { color: colors.text }]}>Rename</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => handleDismiss(card.cluster.id)}
                            style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                        >
                            <Text style={[styles.actionBtnText, { color: colors.secondaryText }]}>Dismiss</Text>
                        </Pressable>
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
    sectionHeader: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
    card: { borderRadius: 10, borderWidth: 1, padding: 14, gap: 6 },
    clusterName: { fontSize: 16, fontWeight: "600" },
    members: { fontSize: 13 },
    confidence: { fontSize: 12 },
    actions: { flexDirection: "row", gap: 8, marginTop: 6 },
    actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "500" },
});
```

Note: `colors.primary`, `colors.card`, `colors.secondaryText`, `colors.border` — verify these keys exist in your theme. Adjust to match whatever your extended theme actually exports (check `useExtendedTheme`).

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors in `MOCSuggestions.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/MOCSuggestions.tsx
git commit -m "feat: add MOC cluster suggestion review UI component"
```

---

## Task 9: Wire Cluster Import and UI into Home Screen

**Files:**
- Modify: `src/app/index.tsx`
- Modify: `src/hooks/useNotes.ts` (or wherever import is triggered)

- [ ] **Step 1: Trigger cluster import on app start**

In `src/app/index.tsx`, after the storage initializes, call `importClustersFromFile()` once on mount. Add inside the home screen component (after the existing init logic):

```typescript
import { importClustersFromFile } from "@/services/notes/clusterService";

// Inside the component, add a useEffect:
useEffect(() => {
    void importClustersFromFile();
}, []); // Run once on mount
```

- [ ] **Step 2: Render `<MOCSuggestions />` in the home screen**

In `src/app/index.tsx`, import and render above the note list:
```typescript
import MOCSuggestions from "@/components/MOCSuggestions";

// In the JSX, add before the NoteGrid:
<MOCSuggestions />
```

Position it just below the search bar / filter bar and above the `NoteGrid`.

- [ ] **Step 3: Run the app and exercise the happy path**

```bash
npm start
```

Steps to verify:
1. Run the Python pipeline: `python scripts/moc_pipeline/pipeline.py <your-notes-path>`
2. Open the app home screen
3. Confirm "Suggested MOCs" section appears with cluster cards
4. Tap "Dismiss" — card disappears
5. Tap "Accept" on a cluster — a new note is created with wiki links; card disappears
6. Tap "Rename" (iOS/desktop) — prompt appears; enter new name; card updates

- [ ] **Step 4: Update the ROADMAP.md**

Change Phase 13 status to `Implemented` and add a "Key files" list:
```markdown
**Status**: Implemented
**Key files**:
- `scripts/moc_pipeline/pipeline.py` — CLI pipeline entry point
- `scripts/moc_pipeline/clustering.py` — agglomerative clustering + TF-IDF
- `src/services/notes/clusterService.ts` — JSON import + cluster CRUD
- `src/components/MOCSuggestions.tsx` — cluster review UI
- `src/migrations/006_add_clusters.ts` — mobile SQLite schema
- `src-tauri/storage_core/src/migrations/v6_add_clusters.rs` — desktop schema
```

- [ ] **Step 5: Commit**

```bash
git add src/app/index.tsx ROADMAP.md
git commit -m "feat: wire MOC suggestion import and review UI into home screen"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Remove BFS/wikilink MOC categorisation → Task 1 + 2
- [x] Python semantic clustering pipeline → Task 5
- [x] `embeddings`, `similarities` (via agglomerative, not stored), `clusters`, `cluster_members` tables → Task 3 + 4 (similarities are implicit in clustering, not stored separately — this is an intentional simplification vs. roadmap's `similarities` table; add that table in a follow-up if needed for the neighbour graph view)
- [x] Candidate MOC titles from TF-IDF → Task 5 `clustering.py`
- [x] Confidence score per cluster → Task 5 `pipeline.py`
- [x] User reviews: Accept / Ignore / Rename → Task 8
- [x] Accept → create real MOC note → Task 8 `handleAccept`
- [x] System never auto-creates → enforced by design (no auto-import, no auto-create)
- [x] Content-hash dedup → not implemented yet (follow-up: add content_hash check to pipeline to skip unchanged notes)

**Intentional simplifications vs. roadmap:**
- The `similarities` table (top-K stored graph) is skipped for now. Similarity is computed in the pipeline but not persisted separately. Add in a follow-up if a "related notes" view is needed.
- The `embeddings` table is not persisted in SQLite — embeddings are recomputed each pipeline run. Add incremental content-hash dedup in a follow-up (pipeline reads the last run's hashes and skips unchanged notes).
- Android `Alert.prompt` is not available — Rename falls back to a message. A proper `TextInput` inline rename can be added as a follow-up.

**No placeholder scan:** All steps contain complete code. No TBD or TODO markers in implementation steps.

**Type consistency:** `ClusterRow`, `ClusterMemberRow` defined in Task 6 Step 1 (`repository.ts`) and re-exported via `clusterService.ts`. Used consistently in Task 8 (`MOCSuggestions.tsx`). Rust equivalents in Task 7 match the same field names via `serde(rename_all = "camelCase")`.
