# Task 002: Local-First Note Sections and Ranking (GraphQLite)

## Status

- In Progress
- Roadmap entry: `Phase 11: Local-First Note Sections and Ranking`
- Grove workspace: `codex-local-note-sec-15df` / branch `codex/local-note-sections-ranking`

## Design Decisions (Resolved)

### Graph engine: GraphQLite (colliery-io/graphqlite)

We use [**GraphQLite**](https://github.com/colliery-io/graphqlite) — a mature MIT-licensed SQLite extension that adds graph database capabilities via Cypher queries and built-in graph algorithms.

**Why GraphQLite over recursive CTEs:**
- Built-in algorithms we'll use immediately: `degree_centrality()` (MOC detection), `bfs()`/`dfs()` (neighborhood traversal), `pagerank()` (future note ranking), `community_detection()` / `louvain()` (future note clustering)
- Cypher query language (`MATCH`, `CREATE`, `RETURN`) is declarative and more maintainable than hand-written recursive CTEs
- Active project: 252 stars, 17 releases (latest `v0.4.3`), stable Rust + Python bindings
- Works with our existing SQLite databases — no separate graph server

**Extension loading strategy:**
- **Mobile (expo-sqlite)**: `expo-sqlite` supports `loadExtensionAsync(path)` on iOS/Android/macOS/tvOS. The compiled shared library (`.dylib` / `.so`) is bundled as an app asset and loaded at database init.
- **Desktop (Tauri/Rust)**: Use the `graphqlite` Rust crate directly. `Connection::open(path)` auto-registers the extension, or `Connection::open_with_extension(path, ext_path)` for explicit loading. The C extension is statically linked into the Tauri binary.
- **Architectures needed**: iOS `arm64`, Android `arm64-v8a` + `x86_64` (emulator), macOS `arm64` + `x86_64`, Linux `x86_64`.

### Section model: MOC-style collections + computed buckets

Sections are **derived views**, not user-managed metadata:

1. **Pinned** — existing pinned flag, shown first
2. **Recently Edited** — notes modified within the last 7 days, ranked by `modified` DESC, capped at 10
3. **MOC collections** — notes with high degree centrality (≥3 outgoing links) become "Map of Content" hubs. Their BFS neighborhood forms a derived section.
4. **All Notes** — everything else, ordered by `timestamp` DESC

## Implementation Plan

### Step 1: Build and bundle the GraphQLite extension for all target platforms

This is the foundational step. Without the extension loaded, nothing else works.

**1a. Compile the C extension for each architecture:**

Clone `colliery-io/graphqlite` and build `libgraphqlite`:

| Platform | Target | Output |
|----------|--------|--------|
| macOS (desktop) | `x86_64-apple-darwin` | `libgraphqlite.dylib` |
| macOS (desktop) | `aarch64-apple-darwin` | `libgraphqlite.dylib` |
| iOS | `aarch64-apple-ios` | `libgraphqlite.dylib` (or `.framework`) |
| Android | `aarch64-linux-android` | `libgraphqlite.so` |
| Android (emulator) | `x86_64-linux-android` | `libgraphqlite.so` |
| Linux (Tauri) | `x86_64-unknown-linux-gnu` | `libgraphqlite.so` |

Build commands (approximate, per graphqlite's `Makefile`):
```bash
# macOS native
make
# iOS (requires iOS SDK)
make CC="xcrun --sdk iphoneos --toolchain arm64-apple-ios clang" \
     TARGET=arm64-apple-ios
# Android (requires NDK)
make CC="<ndk>/toolchains/llvm/prebuilt/darwin-x86_64/bin/aarch64-linux-android21-clang"
```

**1b. Bundle the extension in the Expo app:**

Place compiled libraries under `assets/graphqlite/`:
```
assets/graphqlite/
  darwin-arm64/libgraphqlite.dylib
  darwin-x86_64/libgraphqlite.dylib
  ios-arm64/libgraphqlite.dylib
  android-arm64-v8a/libgraphqlite.so
  android-x86_64/libgraphqlite.so
```

**1c. Add an Expo config plugin** to ensure the native assets are bundled into the app binary. The plugin copies platform-specific binaries to the appropriate native resource directories during prebuild.

**1d. Tauri desktop**: Add `graphqlite` as a Rust dependency in `src-tauri/Cargo.toml`. The Rust crate wraps the C extension and registers functions at database open time (no `load_extension` call needed on desktop).

**Files to create/modify:**
- `assets/graphqlite/` — compiled binaries per platform
- `plugins/withGraphqliteExtension.js` — Expo config plugin to bundle extension assets
- `src-tauri/Cargo.toml` — add `graphqlite` dependency
- `app.config.js` — register the plugin

### Step 2: Load the GraphQLite extension at app startup

Load the extension into the notes index database immediately after opening it.

**Mobile (expo-sqlite):**
```ts
import * as FileSystem from 'expo-file-system';
import { openDatabaseSync } from 'expo-sqlite';

const db = openDatabaseSync('notes-index.db');
// Resolve platform-specific extension path from bundled assets
const extPath = resolveGraphqlitePath(); // platform-specific resolver
await db.loadExtensionAsync(extPath);
```

**Desktop (Tauri/Rust):**
```rust
use graphqlite::Graph;
let graph = Graph::open("path/to/notes-index.db")?;
// graphqlite is now registered — Cypher queries available immediately
```

**Files to modify:**
- `src/services/notes/notesIndexDb.ts` — add `loadGraphqliteExtension()` called in `initializeDatabase()`
- `src-tauri/src/storage/mod.rs` — switch from raw `rusqlite` to `graphqlite::Graph` / `graphqlite::Connection`
- `src/utils/graphqliteLoader.ts` — new cross-platform extension path resolver

### Step 3: Add `modified` column to notes index (migration 004)

The frontmatter parser already extracts `modified` dates, but the index only stores a single `timestamp`. Add `modified` so the "Recently Edited" bucket can use it.

```sql
ALTER TABLE notes ADD COLUMN modified INTEGER;
```

Populate from frontmatter during `indexNote()` and `rebuildIndex()`. Fall back to `timestamp` when frontmatter has no `modified` field.

**Files to modify:**
- `src/services/notes/indexDb/migrations/004_add_modified_column.ts`
- `src/services/notes/notesIndexDb.ts` — bump DB version, update inserts
- `src/services/notes/notesIndex.ts` — pass `modified` from frontmatter

### Step 4: Sync note graph into GraphQLite at index time

GraphQLite maintains its own node/edge tables inside the same SQLite database. We populate them from our existing note data during `rebuildIndex()`.

**Graph model:**
- **Nodes** = notes. `id` = note filename, `label` = "Note", `properties` = `{title, noteType, modified, pinned, folder}`
- **Edges** = wikilinks. `source` → `target`, `type` = "LINKS_TO"

**Sync flow during `rebuildIndex()`:**
1. Parse `[[wikilink]]` patterns from each note body (regex: `\[\[(.+?)\]\]`)
2. Resolve wikilink titles to note IDs (existing wikilink resolution logic)
3. Upsert note node into graphqlite with properties
4. Upsert edge `source → target` into graphqlite

```rust
// Rust (Tauri)
let g = Graph::open("notes-index.db")?;
g.upsert_node("note-id", &[("title", "My Note"), ("noteType", "resource")], "Note")?;
g.upsert_edge("note-a", "note-b", &[], "LINKS_TO")?;
```

```ts
// TypeScript (mobile) — via Cypher after loading extension
await db.runAsync(`
  MATCH (n:Note {id: $sourceId})
  MATCH (m:Note {id: $targetId})
  MERGE (n)-[r:LINKS_TO]->(m)
`, { sourceId, targetId });
```

**Incremental sync**: On subsequent rebuilds, only re-sync notes whose content has changed (compare `mtime` or content hash). This avoids full graph rebuild on every startup.

**Files to modify:**
- `src/services/notes/notesIndex.ts` — add `syncGraphqliteGraph(notes)` function
- `src/services/notes/notesIndexDb.ts` — add Cypher query helpers for node/edge upsert
- `src-tauri/src/storage/mod.rs` — add Rust graph sync using `Graph.upsert_node()` / `Graph.upsert_edge()`

### Step 5: Add graph query functions via GraphQLite

Implement the core graph queries using Cypher and graphqlite's built-in algorithms.

```ts
// Direct backlinks
getBacklinks(noteId): Promise<IndexNote[]>
// Cypher: MATCH (n:Note)-[:LINKS_TO]->(m:Note {id: $noteId}) RETURN n ORDER BY n.modified DESC

// Neighborhood (BFS, depth 2)
getGraphNeighborhood(noteId, depth = 2): Promise<IndexNote[]>
// Cypher: MATCH path = (m:Note {id: $noteId})-[:LINKS_TO*1..2]-(n:Note) RETURN DISTINCT n

// MOC detection via degree centrality
getMocScores(): Promise<{ id: string, outgoingCount: number }[]>
// graphqlite degree_centrality() or: Cypher MATCH (n:Note)-[r:LINKS_TO]->() RETURN n.id, count(r)

// Orphaned notes (zero incoming links)
getOrphanedNotes(): Promise<IndexNote[]>
// Cypher: MATCH (n:Note) WHERE NOT ()-[:LINKS_TO]->(n) RETURN n

// Future: PageRank for note ranking
getPageRankScores(): Promise<{ id: string, score: number }[]>
// graphqlite.pagerank(0.85, 20)
```

**Files to modify:**
- `src/services/notes/notesIndexDb.ts` — add Cypher query wrappers
- `src/services/notes/notesIndex.ts` — add service-layer graph functions
- `src-tauri/src/storage/mod.rs` — equivalent Rust graph queries via `Graph` / `Connection` API

### Step 6: Build sectioned note list in `useNotes`

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
3. **MOC sections** — dynamically added for notes with ≥3 outgoing links. Shows BFS neighborhood (capped at 8).
4. **All Notes** — everything else, ordered by `timestamp DESC`

**Files to modify:**
- `src/hooks/useNotes.ts` — compute sections
- `src/services/notes/notesIndex.ts` — add `getSectionedNotes()` service method
- `src/services/notes/notesIndexDb.ts` — add `getRecentlyEditedNotes(limit, daysBack)` query

### Step 7: Update NoteGrid to render sections

Modify `NoteGrid` to accept `sections: NoteSection[]` and render with section headers.

- Pinned: pin icon header
- Recently Edited: clock icon + "Last 7 days"
- MOC sections: link icon + MOC note title; tapping header navigates to MOC note
- All Notes: existing flat list as fallback

**Files to modify:**
- `src/components/NoteGrid.tsx` — sectioned rendering
- `src/app/index.tsx` — pass sectioned data

## Acceptance Criteria

- GraphQLite extension loads successfully on iOS, Android, and Tauri desktop at app startup
- Note graph (nodes + wikilink edges) is populated during index rebuild
- Incremental sync only re-syncs changed notes on subsequent startups
- Graph queries work: backlinks, neighborhood, MOC scores (degree centrality), orphans
- Home screen shows sectioned view: Pinned → Recently Edited → MOC collections → All Notes
- MOC sections appear dynamically when a note has 3+ outgoing links
- Existing flat-list behavior preserved as fallback
- Tauri desktop uses Rust `graphqlite` crate; mobile uses `loadExtensionAsync()` with bundled binaries
- Automated tests cover: graph sync correctness, Cypher query results, section computation logic, NoteGrid rendering

## Candidate Files

### New
- `assets/graphqlite/` — compiled extension binaries per platform
- `plugins/withGraphqliteExtension.js` — Expo config plugin
- `src/utils/graphqliteLoader.ts` — cross-platform extension path resolver
- `src/services/notes/indexDb/migrations/004_add_modified_column.ts`

### Modify
- `src/services/notes/notesIndexDb.ts` — load extension, Cypher queries, modified column, graph sync, sectioned queries
- `src/services/notes/notesIndex.ts` — `syncGraphqliteGraph()`, service-layer graph functions, `getSectionedNotes()`
- `src/services/notes/frontmatter.ts` — verify `modified` is always extracted (likely already done)
- `src/hooks/useNotes.ts` — section computation logic
- `src/components/NoteGrid.tsx` — sectioned rendering
- `src/app/index.tsx` — pass sectioned data
- `app.config.js` — register GraphQLite extension plugin
- `src-tauri/Cargo.toml` — add `graphqlite` dependency
- `src-tauri/src/storage/mod.rs` — switch to `graphqlite::Graph` / `graphqlite::Connection`, graph sync, graph queries

## Risks & Open Questions

- **Extension build complexity**: Compiling `libgraphqlite` for iOS arm64 and Android arm64 requires NDK + iOS SDK cross-compilation. The graphqlite `Makefile` may need patches for mobile targets. This is the highest-risk step.
  - **Mitigation**: Start with macOS desktop build first, then Android (NDK is easier), then iOS (most restrictive). If iOS compilation proves too difficult, fallback to recursive CTEs for mobile only while keeping GraphQLite on desktop.
- **Dual data model**: GraphQLite maintains its own node/edge tables alongside our existing `notes` table. We must keep them in sync. Incremental sync on content-change detection is critical to avoid slow startup.
  - **Mitigation**: Track a `last_sync_hash` per note in the `notes` table. Only re-sync notes where content hash changed.
- **GraphQLite maturity on mobile**: The project explicitly lists macOS/Linux. iOS/Android builds are untested upstream. We may need to patch the Makefile.
- **Database size overhead**: GraphQLite stores nodes and edges with JSON properties, adding ~2-3x the storage of a simple `wiki_links` table. At note-vault scale (hundreds–low-thousands of notes) this is negligible.
- **MOC detection threshold**: 3 outgoing links is a starting heuristic. May need tuning against real note collections.
