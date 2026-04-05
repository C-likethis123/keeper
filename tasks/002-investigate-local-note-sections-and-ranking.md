# Task 002: Local-First Note Sections and Ranking

## Status

- In Progress
- Roadmap entry: `Phase 11: Local-First Note Sections and Ranking`
- Grove workspace: `codex-local-note-sec-15df` / branch `codex/local-note-sections-ranking`

## Design Decisions (Resolved)

### Graph approach: TypeScript over `wiki_links` edge table + recursive CTEs

No C extension. No native compilation. All graph logic lives in TypeScript, backed by a `wiki_links` edge table and SQLite `WITH RECURSIVE` CTEs.

**Why not a C extension (GraphQLite, sqlite-graph, etc.):**
- Every graph extension requires cross-compiling C code for iOS arm64, Android arm64-v8a, Android x86_64, macOS arm64, and Linux x86_64
- The algorithms we need for v1 (degree centrality, BFS neighborhood, backlinks) are simple enough to express as single SQL queries + TypeScript
- `WITH RECURSIVE` CTEs have been built into SQLite since 3.8.3 (2014) — available in `expo-sqlite` and `rusqlite` with zero setup
- Note-vault scale (hundreds to low-thousands of nodes) is well within CTE performance bounds
- If we later need Louvain community detection or PageRank at scale, we can evaluate a C extension then with concrete performance data

### Section model: MOC-style collections + computed buckets

Sections are **derived views**, not user-managed metadata:

1. **Pinned** — existing pinned flag, shown first
2. **Recently Edited** — notes modified within the last 7 days, ranked by `modified` DESC, capped at 10
3. **MOC collections** — notes with ≥3 outgoing wikilinks become "Map of Content" hubs. Their BFS neighborhood (depth 2) forms a derived section.
4. **All Notes** — everything else, ordered by `timestamp` DESC

## Implementation Plan

### Step 1: Add `wiki_links` edge table (migration 004)

Add a persistent edge table to the notes index database:

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
- `INSERT OR IGNORE` keeps it idempotent
- On note deletion, cascade-delete its outgoing links

**Incremental sync**: Track a `content_hash` per note. Only re-parse wikilinks from notes whose content hash changed since the last index.

**Files to modify:**
- `src/services/notes/notesIndex.ts` — add `parseWikilinksFromBody(content)` → `string[]` (titles), then resolve to IDs and upsert into `wiki_links`
- `src/services/notes/notesIndexDb.ts` — add `insertWikiLinks(sourceId, targetIds)` and `deleteLinksForNote(noteId)`, `updateNoteHash(noteId, hash)`

### Step 3: Add `modified` column to notes index

The frontmatter parser already extracts `modified` dates, but the index only stores a single `timestamp` from file mtime. Add `modified` as a proper column so the "Recently Edited" bucket can use it without re-parsing every note.

```sql
ALTER TABLE notes ADD COLUMN modified INTEGER;
```

Populate from frontmatter during `indexNote()` and `rebuildIndex()`. Fall back to `timestamp` when frontmatter has no `modified` field.

**Files to modify:**
- `src/services/notes/indexDb/migrations/005_add_modified_column.ts` — migration
- `src/services/notes/notesIndexDb.ts` — update `insertNote`/`insertNotes` to accept `modified`
- `src/services/notes/notesIndex.ts` — pass `modified` from frontmatter to index insert
- `IndexNote` type — add `modified?: number`

### Step 4: Add graph query functions (TypeScript over recursive CTEs)

Implement the core graph queries as composable functions in `notesIndexDb.ts`. These are the building blocks for sections and MOC collections.

```ts
// Direct backlinks: which notes link TO this note?
getBacklinks(noteId): Promise<IndexNote[]>
// SELECT n.* FROM notes n JOIN wiki_links wl ON n.id = wl.source_id WHERE wl.target_id = ? ORDER BY n.timestamp DESC

// Transitive backlinks: N-hop backlink chain via recursive CTE
getTransitiveBacklinks(noteId, maxDepth = 3): Promise<IndexNote[]>
// WITH RECURSIVE backlinks(note_id, depth) AS (
//   SELECT wl.source_id, 1 FROM wiki_links wl WHERE wl.target_id = ?
//   UNION
//   SELECT wl.source_id, bl.depth + 1 FROM backlinks bl
//   JOIN wiki_links wl ON wl.target_id = bl.note_id WHERE bl.depth < ?
// )
// SELECT n.* FROM notes n JOIN backlinks bl ON n.id = bl.note_id
// ORDER BY bl.depth ASC, n.timestamp DESC

// Outgoing links: which notes does this note link to?
getOutgoingLinks(noteId): Promise<IndexNote[]>
// SELECT n.* FROM notes n JOIN wiki_links wl ON n.id = wl.target_id WHERE wl.source_id = ?

// MOC scores: outgoing link count for MOC detection
getMocScores(): Promise<{ id: string, outgoingCount: number }[]>
// SELECT source_id AS id, COUNT(*) AS outgoingCount FROM wiki_links GROUP BY source_id

// BFS neighborhood: all notes within N hops (union of in + out edges)
getGraphNeighborhood(noteId, depth = 2): Promise<IndexNote[]>
// WITH RECURSIVE neighbors(note_id, hop) AS (
//   SELECT target_id, 1 FROM wiki_links WHERE source_id = ?
//   UNION
//   SELECT source_id, 1 FROM wiki_links WHERE target_id = ?
//   UNION
//   SELECT wl.target_id, n.hop + 1 FROM neighbors n
//   JOIN wiki_links wl ON wl.source_id = n.note_id WHERE n.hop < ?
//   UNION
//   SELECT wl.source_id, n.hop + 1 FROM neighbors n
//   JOIN wiki_links wl ON wl.target_id = n.note_id WHERE n.hop < ?
// )
// SELECT DISTINCT n.* FROM notes n JOIN neighbors ON n.id = neighbors.note_id

// Orphaned notes: notes with zero incoming links
getOrphanedNotes(): Promise<IndexNote[]>
// SELECT * FROM notes WHERE id NOT IN (SELECT DISTINCT target_id FROM wiki_links)
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
```

Default sections:
1. **Pinned** — existing pinned notes
2. **Recently Edited** — notes with `modified` within last 7 days, capped at 10, ordered by `modified DESC`
3. **MOC sections** — dynamically added for notes with ≥3 outgoing links. Shows BFS neighborhood (capped at 8), ordered by proximity to MOC note.
4. **All Notes** — everything else, ordered by `timestamp DESC`

A note can appear in multiple sections (pinned + MOC + all). The "All Notes" section excludes notes already shown in earlier sections to avoid duplication.

**Files to modify:**
- `src/hooks/useNotes.ts` — compute sections instead of flat list
- `src/services/notes/notesIndex.ts` — add `getSectionedNotes()` service method
- `src/services/notes/notesIndexDb.ts` — add `getRecentlyEditedNotes(limit, daysBack)` query

### Step 6: Update NoteGrid to render sections

Modify `NoteGrid` to accept a `sections: NoteSection[]` prop and render with section headers.

- Pinned section: show pin icon in header
- Recently Edited: show clock icon + relative time range ("Last 7 days")
- MOC sections: show link icon + MOC note title as header, tapping header navigates to MOC note
- All Notes: existing flat list behavior as fallback

**Files to modify:**
- `src/components/NoteGrid.tsx` — sectioned rendering, `SectionList` or grouped `FlashList`
- `src/app/index.tsx` — pass sectioned data instead of flat array

### Step 7: Desktop parity (Tauri)

Ensure the same `wiki_links` table and graph queries exist in the Tauri/Rust storage layer.

**Files to create/modify:**
- `src-tauri/src/storage/migrations/` — add SQL migrations for `wiki_links` + `modified` column
- `src-tauri/src/storage/mod.rs` — add graph query functions (same recursive CTEs, via `rusqlite`)
- `src-tauri/src/lib.rs` — expose Tauri commands if the frontend calls them directly

## Acceptance Criteria

- `wiki_links` edge table exists in both mobile (`expo-sqlite`) and desktop (Tauri `rusqlite`) databases
- Wikilinks are parsed and persisted during note indexing (rebuild is idempotent)
- Incremental sync: only re-parses notes whose content changed (content hash)
- `modified` column is populated from frontmatter with `timestamp` fallback
- Recursive CTE queries work: backlinks, transitive backlinks, outgoing links, neighborhood, MOC scores, orphans
- Home screen shows sectioned view: Pinned → Recently Edited → MOC collections → All Notes
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
- `src/services/notes/notesIndexDb.ts` — wiki_links CRUD, graph queries, modified column, content hash tracking, getRecentlyEditedNotes
- `src/services/notes/notesIndex.ts` — wikilink parsing during index, service-layer graph queries, getSectionedNotes
- `src/services/notes/frontmatter.ts` — ensure `modified` is always extracted (verify, likely already done)
- `src/hooks/useNotes.ts` — section computation logic
- `src/components/NoteGrid.tsx` — sectioned rendering
- `src/app/index.tsx` — pass sectioned data
- `src-tauri/src/storage/mod.rs` — Rust graph queries (same CTEs via rusqlite)
- `src/components/NoteFiltersDropdown.tsx` — potentially add section filter

## Risks & Open Questions

- **Indexing performance**: Parsing wikilinks from every note body during `rebuildIndex()` adds I/O. For large vaults this could slow startup. Mitigation: track `content_hash` per note and only re-parse changed notes.
- **MOC detection threshold**: 3 outgoing links is a starting heuristic. May need tuning. Could be made user-configurable later.
- **Recently Edited window**: 7 days is the default. Should be adjustable, but v1 can hardcode it.
- **Circular wikilinks**: A→B→A cycles are handled by `UNION` (dedup) in recursive CTEs, plus explicit `depth` cap prevents runaway queries.
- **Frontmatter `modified` staleness**: If a note is edited outside Keeper (e.g., GitHub), the frontmatter `modified` may not match file `mtime`. v1 prefers frontmatter; file `mtime` is the fallback.
- **No C extension risk**: This approach uses zero native compilation. Everything is pure SQL + TypeScript + standard SQLite features available on all platforms.
