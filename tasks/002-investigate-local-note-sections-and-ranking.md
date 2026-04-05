# Task 002: Local-First Note Sections and Ranking

## Status

- In Progress
- Roadmap entry: `Phase 11: Investigate Local-First Note Sections and Ranking`
- Grove workspace: `codex-local-note-sec-15df` / branch `codex/local-note-sections-ranking`

## Design Decisions (Resolved)

### Section model: MOC-style collections + computed buckets

Sections are **derived views**, not user-managed metadata. Two kinds:

1. **Computed buckets** — auto-generated sections based on signal thresholds:
   - **Recently Edited** — notes modified within the last N days (default 7), ranked by `modified` DESC
   - **Pinned** — existing pinned flag, shown first
2. **MOC-style collections** — notes that act as "Maps of Content" are detected by having a high outgoing-link count. Their neighborhood (notes they link to + notes that link back) forms a derived collection. No explicit `collections` frontmatter field in v1; MOC detection is purely structural.

### Graph queries: recursive CTEs, no native extension

All graph traversal uses `WITH RECURSIVE` CTEs. No C extension is needed because:
- Recursive CTEs are built into SQLite 3.8.3+ (available in `expo-sqlite` and `rusqlite`)
- Note vault scale (hundreds–low-thousands of nodes) is well within CTE performance bounds
- A C extension (`sqlite-graph`, `graphqlite`) would require `load_extension()` which is blocked on iOS
- If performance becomes an issue at scale, a Rust-compiled extension can be added for Tauri desktop only

## Implementation Plan

### Step 1: Add `wiki_links` edge table (migration 004)

Add a persistent edge table to the notes index database for graph queries.

```sql
CREATE TABLE IF NOT EXISTS wiki_links (
  source_id TEXT NOT NULL,   -- note containing the wikilink
  target_id TEXT NOT NULL,   -- note being linked to ([[Title]])
  PRIMARY KEY (source_id, target_id)
);
CREATE INDEX IF NOT EXISTS idx_wiki_links_target ON wiki_links(target_id);
CREATE INDEX IF NOT EXISTS idx_wiki_links_source ON wiki_links(source_id);
```

**Files to create/modify:**
- `src/services/notes/indexDb/migrations/004_wiki_links.ts` — new migration
- `src/services/notes/notesIndexDb.ts` — bump DB version, run migration

### Step 2: Populate `wiki_links` during index rebuild

Parse `[[wikilink]]` patterns from note body content during `rebuildIndex()`. Resolve each wikilink title to a target note ID using the existing wikilink resolution logic.

- Strip `todo: ` prefix from `TODO: ` titles when matching (reuse `wikiLinkUtils.ts` logic)
- On collision (same source→target pair), `INSERT OR IGNORE` keeps it idempotent
- On note deletion, cascade-delete its outgoing links

**Files to modify:**
- `src/services/notes/notesIndex.ts` — add `parseWikilinksFromBody(content)` → `string[]` (titles), then resolve to IDs and upsert into `wiki_links`
- `src/services/notes/notesIndexDb.ts` — add `insertWikiLinks(sourceId, targetIds)` and `deleteLinksForNote(noteId)`

### Step 3: Add `modified` column to notes index

The frontmatter parser already extracts `modified` dates, but the index only stores a single `timestamp` from file mtime. Add `modified` as a proper column so the "Recently Edited" bucket can use it without re-parsing every note.

```sql
ALTER TABLE notes ADD COLUMN modified INTEGER;
```

Populate from frontmatter during `indexNote()` and `rebuildIndex()`. Fall back to `timestamp` when frontmatter has no `modified` field.

**Files to modify:**
- `src/services/notes/notesIndexDb.ts` — migration 005 (ALTER TABLE), update `insertNote`/`insertNotes`
- `src/services/notes/notesIndex.ts` — pass `modified` from frontmatter to index insert
- `IndexNote` type — add `modified?: number`

### Step 4: Add graph query functions (TypeScript over recursive CTEs)

Implement the core graph queries as composable functions in `notesIndexDb.ts`. These are the building blocks for sections and MOC collections.

```ts
// Direct backlinks: which notes link TO this note?
getBacklinks(noteId): Promise<IndexNote[]>

// Transitive backlinks: N-hop backlink chain via recursive CTE
getTransitiveBacklinks(noteId, maxDepth = 3): Promise<IndexNote[]>

// Outgoing links: which notes does this note link to?
getOutgoingLinks(noteId): Promise<IndexNote[]>

// MOC score: outgoing link count. Notes with many outgoing links are collection hubs.
getMocScores(): Promise<{ id: string, outgoingCount: number }[]>

// Graph neighborhood: all notes within N hops of a seed note (union of in + out edges)
getGraphNeighborhood(noteId, depth = 2): Promise<IndexNote[]>

// Orphaned notes: notes with zero incoming links
getOrphanedNotes(): Promise<IndexNote[]>
```

**Key recursive CTE example (transitive backlinks):**
```sql
WITH RECURSIVE backlinks(note_id, depth) AS (
  SELECT wl.source_id, 1
  FROM wiki_links wl
  WHERE wl.target_id = ?
  UNION
  SELECT wl.source_id, bl.depth + 1
  FROM backlinks bl
  JOIN wiki_links wl ON wl.target_id = bl.note_id
  WHERE bl.depth < ?
)
SELECT n.* FROM notes n
JOIN backlinks bl ON n.id = bl.note_id
ORDER BY bl.depth ASC, n.timestamp DESC
```

**Files to modify:**
- `src/services/notes/notesIndexDb.ts` — add all graph query methods
- `src/services/notes/notesIndex.ts` — add service-layer wrappers

### Step 5: Build sectioned note list in `useNotes`

Replace the flat `getIndexedNotes()` → pinned + remaining model with a sectioned structure:

```ts
type NoteSection = {
  id: string;              // 'pinned' | 'recently-edited' | 'moc:<noteId>' | 'all'
  title: string;           // 'Pinned' | 'Recently Edited' | '<MOC Note Title>' | 'All Notes'
  notes: NoteMetadata[];
};

type SectionedNoteList = {
  sections: NoteSection[];
  isLoading: boolean;
  error: string | null;
};
```

Default sections:
1. **Pinned** — existing pinned notes
2. **Recently Edited** — notes with `modified` within last 7 days, capped at 10, ordered by `modified DESC`
3. **All Notes** — everything else, ordered by `timestamp DESC` (existing behavior)

MOC sections are added dynamically when a note's outgoing-link count exceeds a threshold (default: 3). The MOC section shows its neighborhood (linked notes) capped at 8.

**Files to modify:**
- `src/hooks/useNotes.ts` — compute sections instead of flat list
- `src/services/notes/notesIndex.ts` — add `getSectionedNotes()` service method
- `src/services/notes/notesIndexDb.ts` — add `getRecentlyEditedNotes(limit, daysBack)` query

### Step 6: Update NoteGrid to render sections

Modify `NoteGrid` to accept a `sections: NoteSection[]` prop and render `SectionList` (React Native) or grouped `FlashList` with section headers.

- Pinned section: show pin icon in header
- Recently Edited: show clock icon + relative time range ("Last 7 days")
- MOC sections: show link icon + MOC note title as header, tapping header navigates to MOC note
- All Notes: existing flat list behavior as fallback

**Files to modify:**
- `src/components/NoteGrid.tsx` — sectioned rendering, `SectionList` or grouped `FlashList`
- `src/app/index.tsx` — pass sectioned data instead of flat array

### Step 7: Desktop parity (Tauri)

Ensure the same `wiki_links` table and graph queries exist in the Tauri/Rust storage layer. Since Tauri uses a separate Rust SQLite backend, add equivalent schema and queries.

**Files to create/modify:**
- `src-tauri/src/storage/migrations/` — add SQL migration for `wiki_links` + `modified` column
- `src-tauri/src/storage/` — add graph query functions (same recursive CTEs, via `rusqlite`)
- `src-tauri/src/lib.rs` — expose Tauri commands if the frontend calls them directly

## Acceptance Criteria

- `wiki_links` edge table exists in both mobile (`expo-sqlite`) and desktop (Tauri `rusqlite`) databases
- Wikilinks are parsed and persisted during note indexing (rebuild is idempotent)
- `modified` column is populated from frontmatter with `timestamp` fallback
- Recursive CTE queries work: backlinks, transitive backlinks, outgoing links, neighborhood, MOC scores, orphans
- Home screen shows sectioned view: Pinned → Recently Edited → All Notes
- MOC sections appear dynamically when a note has 3+ outgoing links
- Existing flat-list behavior is preserved as a fallback when sections are empty
- Automated tests cover: link parsing, CTE query correctness, section computation logic, and NoteGrid section rendering

## Candidate Files

### New
- `src/services/notes/indexDb/migrations/004_wiki_links.ts`
- `src/services/notes/indexDb/migrations/005_add_modified_column.ts`
- `src-tauri/src/storage/migrations/v4_add_wiki_links.rs`
- `src-tauri/src/storage/migrations/v5_add_modified_column.rs`

### Modify
- `src/services/notes/notesIndexDb.ts` — wiki_links CRUD, graph queries, modified column, getRecentlyEditedNotes
- `src/services/notes/notesIndex.ts` — wikilink parsing during index, service-layer graph queries, getSectionedNotes
- `src/services/notes/frontmatter.ts` — ensure `modified` is always extracted (verify, likely already done)
- `src/hooks/useNotes.ts` — section computation logic
- `src/components/NoteGrid.tsx` — sectioned rendering
- `src/app/index.tsx` — pass sectioned data
- `src-tauri/src/storage/mod.rs` — Rust graph queries
- `src/components/NoteFiltersDropdown.tsx` — potentially add section filter

## Risks & Open Questions

- **Indexing performance**: Parsing wikilinks from every note body during `rebuildIndex()` adds I/O. For large vaults this could slow startup. Mitigation: only re-parse notes whose content changed since last index.
- **MOC detection threshold**: 3 outgoing links is a starting heuristic. May need tuning. Could be made user-configurable later.
- **Recently Edited window**: 7 days is the default. Should be adjustable, but v1 can hardcode it.
- **Circular wikilinks**: A→B→A cycles are handled by `UNION` (dedup) in recursive CTEs, but the `depth` cap prevents runaway queries.
- **Frontmatter `modified` staleness**: If a note is edited outside Keeper (e.g., GitHub), the frontmatter `modified` may not match file `mtime`. v1 prefers frontmatter; file `mtime` is the fallback.
