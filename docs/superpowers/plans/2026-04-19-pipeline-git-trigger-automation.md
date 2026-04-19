# Pipeline Automation: Git-Triggered Cluster Updates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically run the MOC clustering pipeline whenever notes in the Git-backed store change, and have the Keeper app import the resulting clusters after each sync.

**Architecture:** A GitHub Actions workflow in the notes repository triggers `pipeline.py` on every push to main that touches `.md` files. The pipeline uses a **git-commit-based embedding cache**: after each successful run it writes the current HEAD SHA to `.moc_cache/head.txt`. On the next run it calls `git diff --name-only <stored_head> HEAD` to find which `.md` files changed, re-embeds only those files, and leaves all other embeddings (stored by relative file path in `.moc_cache/embeddings.json`) untouched. The output (`.moc_clusters.json`) is committed back to the notes repo. On the app side, `dbSyncService.syncDbAfterPull()` detects when `.moc_clusters.json` is in the synced changed paths and calls `importClustersFromFile()` so the SQLite cluster tables are updated before `contentVersion` is bumped and the UI refreshes.

**Tech Stack:** Python 3.12 (GitHub Actions runner), GitHub Actions YAML, TypeScript/Expo (app-side post-sync hook), Rust (Git engine extension).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/git_core/src/lib.rs` | **Modify** | Add `changed_paths` (unfiltered) to the Rust git core |
| `src/services/git/engines/GitEngine.ts` | **Modify** | Add `changedPaths` to the TS interface |
| `src/services/git/engines/RustGitEngine.ts` | **Modify** | Implement `changedPaths` using the new Rust bridge |
| `modules/keeper-git/src/index.ts` | **Modify** | Add `changedPaths` to the Expo module interface |
| `modules/keeper-git/ios/KeeperGitBridgeModule.swift` | **Modify** | Wrap the new Rust `changed_paths` for iOS |
| `modules/keeper-git/android/src/main/java/.../KeeperGitBridgeModule.kt` | **Modify** | Wrap the new Rust `changed_paths` for Android |
| `scripts/moc_pipeline/cache.py` | **Create** | Git-commit-based embedding cache logic |
| `scripts/moc_pipeline/tests/test_cache.py` | **Create** | Unit tests for cache module |
| `scripts/moc_pipeline/pipeline.py` | **Modify** | Update `load_notes` and `main` to use the cache |
| `docs/notes-repo-setup/moc-pipeline.yml` | **Create** | GitHub Actions workflow template |
| `src/services/git/init/dbSyncService.ts` | **Modify** | Detect cluster file changes via `changedPaths` |
| `src/services/git/init/types.ts` | **Modify** | Add `didImportClusters` to result type |

---

## Task 1: Expand GitEngine to support unfiltered changed paths

Currently `changedMarkdownPaths` only returns `.md` files. We need to see `.moc_clusters.json`.

- [ ] **Step 1: Add `changed_paths` to `src-tauri/git_core/src/lib.rs`**

Add a new `changed_paths` function (duplicate of `changed_markdown_paths` but without the extension filter) and export it for FFI (Tauri, JNI, Swift).

- [ ] **Step 2: Update `src/services/git/engines/GitEngine.ts`**

```typescript
	changedPaths(
		dir: string,
		fromOid: string,
		toOid: string,
	): Promise<GitChangedPaths>;
```

- [ ] **Step 3: Implement in `src/services/git/engines/RustGitEngine.ts`**

Wire it to the new native bridge call.

- [ ] **Step 4: Update Native Modules**

Update `modules/keeper-git/src/index.ts`, `KeeperGitBridgeModule.swift`, and `KeeperGitBridgeModule.kt` to expose the new method.

---

## Task 2: Embedding cache module

**Files:**
- Create: `scripts/moc_pipeline/cache.py`
- Create: `scripts/moc_pipeline/tests/test_cache.py`

- [ ] **Step 1: Implement cache.py**

```python
from __future__ import annotations
import json
import subprocess
from pathlib import Path
from typing import Callable
import numpy as np

_CACHE_DIR = ".moc_cache"
_HEAD_FILE = "head.txt"
_EMBEDDINGS_FILE = "embeddings.json"

def load_head(notes_root: Path) -> str | None:
    path = notes_root / _CACHE_DIR / _HEAD_FILE
    return path.read_text(encoding="utf-8").strip() if path.exists() else None

def save_head(notes_root: Path, commit: str) -> None:
    d = notes_root / _CACHE_DIR
    d.mkdir(exist_ok=True)
    (d / _HEAD_FILE).write_text(commit, encoding="utf-8")

def load_embeddings(notes_root: Path) -> dict[str, list[float]]:
    path = notes_root / _CACHE_DIR / _EMBEDDINGS_FILE
    if not path.exists(): return {}
    try: return json.loads(path.read_text(encoding="utf-8"))
    except: return {}

def save_embeddings(notes_root: Path, data: dict[str, list[float]]) -> None:
    d = notes_root / _CACHE_DIR
    d.mkdir(exist_ok=True)
    (d / _EMBEDDINGS_FILE).write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")

def get_changed_paths(notes_root: Path, since_commit: str | None, until_commit: str) -> list[str]:
    if since_commit is None:
        result = subprocess.run(["git", "-C", str(notes_root), "ls-tree", "-r", "--name-only", until_commit], capture_output=True, text=True, check=True)
    else:
        result = subprocess.run(["git", "-C", str(notes_root), "diff", "--name-only", since_commit, until_commit], capture_output=True, text=True, check=True)
    return [p for p in result.stdout.splitlines() if p.endswith(".md")]

def cached_embeddings(notes: dict[str, str], notes_root: Path, current_head: str, generate_fn: Callable[[list[str]], np.ndarray]) -> dict[str, list[float]]:
    last_head = load_head(notes_root)
    cache = load_embeddings(notes_root)
    changed = set(get_changed_paths(notes_root, last_head, current_head))
    
    for path in list(cache.keys()):
        if path not in notes: del cache[path]

    to_embed = [(path, text) for path, text in notes.items() if path in changed]
    if to_embed:
        paths, texts = zip(*to_embed)
        new_embs = generate_fn(list(texts))
        for path, emb in zip(paths, new_embs):
            cache[path] = emb.tolist()

    save_embeddings(notes_root, cache)
    save_head(notes_root, current_head)
    return cache
```

- [ ] **Step 2: Implement unit tests**

Create `scripts/moc_pipeline/tests/test_cache.py` covering incremental updates, deletions, and full rebuilds.

---

## Task 3: Wire embedding cache into pipeline.py

**Files:**
- Modify: `scripts/moc_pipeline/pipeline.py`

- [ ] **Step 1: Update `load_notes` to include path in meta**

```python
def load_notes(notes_root: Path) -> tuple[list[str], list[str], list[dict]]:
    # ... inside loop
        meta = _parse_frontmatter_meta(content)
        rel = md_file.relative_to(notes_root)
        meta["path"] = str(rel) # Relative path WITH extension for cache key
        # ...
```

- [ ] **Step 2: Expose `generate_embeddings` for testing**

Ensure `generate_embeddings` is accessible at module level in `pipeline.py` so it can be monkeypatched in tests.

- [ ] **Step 3: Update `main()` to use `cached_embeddings`**

```python
    print("Generating embeddings...")
    notes_dict = {meta["path"]: text for meta, text in zip(metas, texts)}
    current_head = _current_head(notes_root) # subprocess.run(["git", "rev-parse", "HEAD"])
    emb_cache = cached_embeddings(notes_dict, notes_root, current_head, generate_embeddings)
    embeddings = np.array([emb_cache[meta["path"]] for meta in metas])
```

---

## Task 4: GitHub Actions workflow template

**Files:**
- Create: `docs/notes-repo-setup/moc-pipeline.yml`

- [ ] **Step 1: Create the workflow template**

Use `actions/cache@v4` to store `.moc_cache`. Ensure it triggers on push to `main` for `.md` files and uses `[skip ci]` in the bot commit message to prevent infinite loops.

---

## Task 5: Auto-import clusters in the app after remote sync

**Files:**
- Modify: `src/services/git/init/types.ts`
- Modify: `src/services/git/init/dbSyncService.ts`

- [ ] **Step 1: Add `didImportClusters` to `SyncDbAfterPullResult`**
- [ ] **Step 2: Update `dbSyncService.ts` to use `changedPaths`**

Replace `getChangedMarkdownPaths` call with `this.gitEngine.changedPaths`. Check for `.moc_clusters.json` in `added` or `modified` lists. Call `importClustersFromFile()`.

- [ ] **Step 3: Verify with tests**

Add `src/services/git/init/__tests__/dbSyncService.test.ts` to mock `GitEngine.changedPaths` returning the cluster file and verify the import call.

---

## Verification

- [ ] Pipeline re-runs quickly when only 1 note changes (check logs for embedding count).
- [ ] Deleted notes are removed from the cache and clusters.
- [ ] Cluster import triggers automatically in the app after `git pull` fetches a new `.moc_clusters.json`.
- [ ] Full rebuilds (e.g. fresh install) still correctly import clusters.
