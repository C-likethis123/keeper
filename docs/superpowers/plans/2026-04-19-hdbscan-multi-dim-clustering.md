# HDBSCAN Multi-Dimensional Clustering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Agglomerative/KMeans clustering with HDBSCAN, filter out journals and todos from the pipeline, and cluster on four dimensions: semantic similarity, temporal proximity, wiki-link graph, and tags.

**Architecture:** The Python pipeline (`scripts/moc_pipeline/`) is self-contained. We compute four distance matrices (semantic cosine, temporal, graph shortest-path, tag Jaccard), fuse them into a composite distance matrix, then feed it into HDBSCAN as a precomputed distance. Filtering happens at note-load time by checking the frontmatter `type` field. The JSON output schema stays unchanged so the TypeScript side needs no modification.

**Tech Stack:** Python 3.14, `hdbscan` library, `numpy`, `scikit-learn`, `sentence-transformers`, existing `parseFrontmatter`-style YAML parsing in Python.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/moc_pipeline/pipeline.py` | Modify | Filter journals/todos; pass metadata to `cluster_notes`; pass note_ids/texts for graph+tag features |
| `scripts/moc_pipeline/clustering.py` | Rewrite | Replace `AgglomerativeClustering` with HDBSCAN; build composite distance matrix |
| `scripts/moc_pipeline/features.py` | **Create** | Build temporal, graph-link, and tag distance matrices |
| `scripts/moc_pipeline/embeddings.py` | No change | Semantic embeddings |
| `scripts/moc_pipeline/requirements.txt` | Modify | Add `hdbscan` |
| `scripts/moc_pipeline/tests/test_features.py` | **Create** | Unit tests for feature builders |
| `scripts/moc_pipeline/tests/test_clustering.py` | **Create** | Unit tests for HDBSCAN wrapper |
| `scripts/moc_pipeline/tests/test_pipeline.py` | **Create** | Integration test: filter, cluster end-to-end |

---

## Task 1: Set up test infrastructure and add hdbscan dependency

**Files:**
- Modify: `scripts/moc_pipeline/requirements.txt`
- Create: `scripts/moc_pipeline/tests/__init__.py`

- [ ] **Step 1: Add hdbscan to requirements**

Edit `scripts/moc_pipeline/requirements.txt` to:

```
sentence-transformers>=2.7.0
scikit-learn>=1.4.0
numpy>=1.26.0
hdbscan>=0.8.38
```

- [ ] **Step 2: Create tests package**

```bash
mkdir -p scripts/moc_pipeline/tests
touch scripts/moc_pipeline/tests/__init__.py
```

- [ ] **Step 3: Install dependencies**

```bash
cd scripts/moc_pipeline && pip install -r requirements.txt
```

Expected: `hdbscan` installs without error. Verify:

```bash
python -c "import hdbscan; print(hdbscan.__version__)"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/moc_pipeline/requirements.txt scripts/moc_pipeline/tests/__init__.py
git commit -m "chore: add hdbscan dependency and test package"
```

---

## Task 2: Filter journals and todos in pipeline.py

**Files:**
- Modify: `scripts/moc_pipeline/pipeline.py`
- Create: `scripts/moc_pipeline/tests/test_pipeline.py`

The `load_notes` function currently reads all `.md` files. We need to skip any file whose frontmatter contains `type: journal` or `type: todo`. We parse frontmatter with a minimal inline regex — same logic as `parseFrontmatter` in TypeScript.

- [ ] **Step 1: Write the failing test**

Create `scripts/moc_pipeline/tests/test_pipeline.py`:

```python
import sys
from pathlib import Path
import tempfile

sys.path.insert(0, str(Path(__file__).parent.parent))
from pipeline import load_notes


def _write(tmp: Path, name: str, content: str) -> None:
    (tmp / name).write_text(content, encoding="utf-8")


def test_load_notes_excludes_journals_and_todos():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        _write(root, "note.md", "---\ntype: note\ntitle: A note\n---\nHello")
        _write(root, "journal.md", "---\ntype: journal\ntitle: Daily\n---\nToday...")
        _write(root, "todo.md", "---\ntype: todo\ntitle: Buy milk\n---\n- [ ] milk")
        _write(root, "resource.md", "---\ntype: resource\ntitle: Some URL\n---\nhttps://example.com")
        ids, texts, metas = load_notes(root)
        titles = [m["title"] for m in metas]
        assert "A note" in titles
        assert "Some URL" in titles
        assert "Daily" not in titles
        assert "Buy milk" not in titles
        assert len(ids) == 2


def test_load_notes_returns_metadata():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        _write(root, "note.md", "---\ntype: note\ntitle: Hello\ntags: foo, bar\nmodified: 1713000000000\n---\nContent with [[Other Note]]")
        ids, texts, metas = load_notes(root)
        assert len(ids) == 1
        m = metas[0]
        assert m["title"] == "Hello"
        assert m["tags"] == ["foo", "bar"]
        assert m["modified"] == 1713000000000
        assert "Other Note" in m["wikilinks"]
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd scripts/moc_pipeline && python -m pytest tests/test_pipeline.py -v
```

Expected: `ImportError` or `TypeError` — `load_notes` returns 2-tuple not 3-tuple.

- [ ] **Step 3: Rewrite `load_notes` to filter and return metadata**

Replace the entire `load_notes` function in `scripts/moc_pipeline/pipeline.py`:

```python
import re as _re

_FRONTMATTER_RE = _re.compile(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?")
_WIKILINK_RE = _re.compile(r"\[\[(.+?)\]\]")
_EXCLUDED_TYPES = {"journal", "todo"}


def _parse_frontmatter_meta(markdown: str) -> dict:
    """Extract type, title, tags, modified, and wikilinks from note."""
    meta: dict = {"type": "note", "title": "", "tags": [], "modified": None, "wikilinks": []}
    m = _FRONTMATTER_RE.match(markdown)
    if m:
        for line in m.group(1).splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            sep = line.find(":")
            if sep < 0:
                continue
            key = line[:sep].strip()
            val = line[sep + 1:].strip().strip('"').strip("'")
            if key == "type":
                meta["type"] = val
            elif key == "title":
                meta["title"] = val
            elif key == "tags":
                meta["tags"] = [t.strip() for t in val.split(",") if t.strip()]
            elif key == "modified":
                try:
                    meta["modified"] = int(val)
                except ValueError:
                    pass
        body = markdown[m.end():]
    else:
        body = markdown
    meta["wikilinks"] = [w.strip() for w in _WIKILINK_RE.findall(body) if w.strip()]
    return meta


def load_notes(notes_root: Path) -> tuple[list[str], list[str], list[dict]]:
    """Return (note_ids, texts, metas). Excludes journals and todos."""
    note_ids: list[str] = []
    texts: list[str] = []
    metas: list[dict] = []
    for md_file in sorted(notes_root.rglob("*.md")):
        if any(part.startswith(".") for part in md_file.relative_to(notes_root).parts[:-1]):
            continue
        try:
            content = md_file.read_text(encoding="utf-8")
        except Exception:
            continue
        meta = _parse_frontmatter_meta(content)
        if meta["type"] in _EXCLUDED_TYPES:
            continue
        rel = md_file.relative_to(notes_root)
        note_ids.append(str(rel.with_suffix("")))
        texts.append(content)
        metas.append(meta)
    return note_ids, texts, metas
```

Also update `main()` in `pipeline.py` to unpack the 3-tuple:

```python
note_ids, texts, metas = load_notes(notes_root)
```

- [ ] **Step 4: Run tests**

```bash
cd scripts/moc_pipeline && python -m pytest tests/test_pipeline.py -v
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/moc_pipeline/pipeline.py scripts/moc_pipeline/tests/test_pipeline.py
git commit -m "feat: filter journals and todos from MOC clustering pipeline"
```

---

## Task 3: Build feature distance matrices module

**Files:**
- Create: `scripts/moc_pipeline/features.py`
- Create: `scripts/moc_pipeline/tests/test_features.py`

This module builds three distance matrices (all values in [0, 1]):

1. **Temporal**: normalised absolute difference of `modified` timestamps (capped at 30 days = 1.0).
2. **Graph links**: shortest-path distance via BFS on the wiki-link graph, normalised to [0, 1].
3. **Tag**: Jaccard distance between tag sets (1 - |A∩B|/|A∪B|).

- [ ] **Step 1: Write failing tests**

Create `scripts/moc_pipeline/tests/test_features.py`:

```python
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))
from features import (
    temporal_distance_matrix,
    graph_distance_matrix,
    tag_distance_matrix,
)


def test_temporal_same_time():
    metas = [{"modified": 1000000}, {"modified": 1000000}]
    D = temporal_distance_matrix(metas)
    assert D.shape == (2, 2)
    assert D[0, 1] == pytest.approx(0.0)


def test_temporal_cap_at_one():
    import pytest
    # 31 days apart — should be capped at 1.0
    ms_31_days = 31 * 24 * 3600 * 1000
    metas = [{"modified": 0}, {"modified": ms_31_days}]
    D = temporal_distance_matrix(metas)
    assert D[0, 1] == pytest.approx(1.0)


def test_temporal_none_is_neutral():
    import pytest
    # Notes with no modified timestamp get distance 0.5 to everything
    metas = [{"modified": None}, {"modified": 1000000}]
    D = temporal_distance_matrix(metas)
    assert D[0, 1] == pytest.approx(0.5)


def test_graph_direct_link():
    import pytest
    # note_ids[0] links to note_ids[1]
    note_ids = ["alpha", "beta", "gamma"]
    metas = [
        {"wikilinks": ["beta"]},
        {"wikilinks": []},
        {"wikilinks": []},
    ]
    D = graph_distance_matrix(note_ids, metas)
    assert D[0, 1] == pytest.approx(0.0)   # directly linked = min distance
    assert D[0, 2] > D[0, 1]              # gamma not linked


def test_graph_no_links_all_max():
    import pytest
    note_ids = ["a", "b", "c"]
    metas = [{"wikilinks": []}, {"wikilinks": []}, {"wikilinks": []}]
    D = graph_distance_matrix(note_ids, metas)
    assert D[0, 1] == pytest.approx(1.0)


def test_tag_identical_tags():
    import pytest
    metas = [{"tags": ["foo", "bar"]}, {"tags": ["bar", "foo"]}]
    D = tag_distance_matrix(metas)
    assert D[0, 1] == pytest.approx(0.0)


def test_tag_disjoint_tags():
    import pytest
    metas = [{"tags": ["foo"]}, {"tags": ["bar"]}]
    D = tag_distance_matrix(metas)
    assert D[0, 1] == pytest.approx(1.0)


def test_tag_no_tags_is_neutral():
    import pytest
    metas = [{"tags": []}, {"tags": ["foo"]}]
    D = tag_distance_matrix(metas)
    assert D[0, 1] == pytest.approx(0.5)
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd scripts/moc_pipeline && python -m pytest tests/test_features.py -v
```

Expected: `ModuleNotFoundError: No module named 'features'`.

- [ ] **Step 3: Implement features.py**

Create `scripts/moc_pipeline/features.py`:

```python
from __future__ import annotations

from collections import deque

import numpy as np

_30_DAYS_MS = 30 * 24 * 3600 * 1000


def temporal_distance_matrix(metas: list[dict]) -> np.ndarray:
    """
    Normalised absolute time difference, capped at 1.0 (= 30 days apart).
    Notes with no modified timestamp get 0.5 distance to all others.
    """
    n = len(metas)
    D = np.full((n, n), 0.5, dtype=float)
    np.fill_diagonal(D, 0.0)
    ts = [m.get("modified") for m in metas]
    for i in range(n):
        for j in range(i + 1, n):
            if ts[i] is None or ts[j] is None:
                d = 0.5
            else:
                d = min(abs(ts[i] - ts[j]) / _30_DAYS_MS, 1.0)
            D[i, j] = d
            D[j, i] = d
    return D


def graph_distance_matrix(note_ids: list[str], metas: list[dict]) -> np.ndarray:
    """
    BFS shortest-path distance on undirected wiki-link graph.
    Directly linked notes = 0.0; unreachable = 1.0.
    Normalised by (max_path_len + 1).
    """
    n = len(note_ids)
    id_to_idx = {nid: i for i, nid in enumerate(note_ids)}
    # Resolve wikilinks by title matching (case-insensitive partial match)
    title_to_idx: dict[str, int] = {}
    for i, meta in enumerate(metas):
        t = meta.get("title", "").lower().strip()
        if t:
            title_to_idx[t] = i
        # also index by note_id stem
        title_to_idx[note_ids[i].lower()] = i

    # Build adjacency list (undirected)
    adj: list[set[int]] = [set() for _ in range(n)]
    for i, meta in enumerate(metas):
        for link in meta.get("wikilinks", []):
            key = link.lower().strip()
            j = id_to_idx.get(key) or title_to_idx.get(key)
            if j is not None and j != i:
                adj[i].add(j)
                adj[j].add(i)

    # BFS from each node
    raw = np.full((n, n), n + 1, dtype=float)  # n+1 = unreachable sentinel
    np.fill_diagonal(raw, 0.0)
    for src in range(n):
        dist = {src: 0}
        q: deque[int] = deque([src])
        while q:
            node = q.popleft()
            for nb in adj[node]:
                if nb not in dist:
                    dist[nb] = dist[node] + 1
                    q.append(nb)
        for dst, d in dist.items():
            raw[src, dst] = d

    # Normalise: directly connected = 0, unreachable = 1
    max_finite = raw[raw < n + 1].max() if (raw < n + 1).any() else 1.0
    if max_finite == 0:
        max_finite = 1.0
    D = np.where(raw >= n + 1, 1.0, raw / (max_finite + 1))
    np.fill_diagonal(D, 0.0)
    return D


def tag_distance_matrix(metas: list[dict]) -> np.ndarray:
    """
    Jaccard distance between tag sets.
    If either note has no tags, distance = 0.5 (neutral / unknown).
    """
    n = len(metas)
    D = np.full((n, n), 0.5, dtype=float)
    np.fill_diagonal(D, 0.0)
    tag_sets = [set(m.get("tags", [])) for m in metas]
    for i in range(n):
        for j in range(i + 1, n):
            a, b = tag_sets[i], tag_sets[j]
            if not a or not b:
                d = 0.5
            else:
                intersection = len(a & b)
                union = len(a | b)
                d = 1.0 - intersection / union if union > 0 else 0.0
            D[i, j] = d
            D[j, i] = d
    return D
```

- [ ] **Step 4: Fix the test imports (pytest is not imported in test)**

At the top of `test_features.py` add `import pytest`:

```python
import sys
from pathlib import Path
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from features import (
    temporal_distance_matrix,
    graph_distance_matrix,
    tag_distance_matrix,
)
```

- [ ] **Step 5: Run tests**

```bash
cd scripts/moc_pipeline && python -m pytest tests/test_features.py -v
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/moc_pipeline/features.py scripts/moc_pipeline/tests/test_features.py
git commit -m "feat: add temporal, graph-link, and tag distance matrix builders"
```

---

## Task 4: Replace AgglomerativeClustering with HDBSCAN

**Files:**
- Rewrite: `scripts/moc_pipeline/clustering.py`
- Create: `scripts/moc_pipeline/tests/test_clustering.py`

HDBSCAN accepts a precomputed distance matrix when `metric='precomputed'`. We pass it the composite matrix. Output: integer labels (-1 = noise, same as before).

- [ ] **Step 1: Write failing tests**

Create `scripts/moc_pipeline/tests/test_clustering.py`:

```python
import sys
from pathlib import Path
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from clustering import cluster_notes, extract_cluster_names, average_intra_cluster_similarity


def _tight_block(n: int, offset: float = 0.0) -> np.ndarray:
    """n points clustered tightly: pairwise distance ~0.05."""
    D = np.full((n, n), 0.05)
    np.fill_diagonal(D, 0.0)
    return D


def test_cluster_notes_returns_array_of_correct_length():
    n = 6
    # Two tight groups separated by 0.9
    D = np.full((n, n), 0.9)
    np.fill_diagonal(D, 0.0)
    D[0:3, 0:3] = 0.05
    np.fill_diagonal(D[0:3, 0:3], 0.0)
    D[3:6, 3:6] = 0.05
    np.fill_diagonal(D[3:6, 3:6], 0.0)
    labels = cluster_notes(D)
    assert len(labels) == n


def test_cluster_notes_fewer_than_3_returns_arange():
    D = np.array([[0.0, 0.1], [0.1, 0.0]])
    labels = cluster_notes(D)
    assert list(labels) == [0, 1]


def test_cluster_notes_groups_similar_notes():
    n = 6
    D = np.full((n, n), 0.9)
    np.fill_diagonal(D, 0.0)
    D[0:3, 0:3] = 0.05
    np.fill_diagonal(D[0:3, 0:3], 0.0)
    D[3:6, 3:6] = 0.05
    np.fill_diagonal(D[3:6, 3:6], 0.0)
    labels = cluster_notes(D)
    # First 3 and last 3 should be in different clusters (both non-noise)
    assert labels[0] == labels[1] == labels[2]
    assert labels[3] == labels[4] == labels[5]
    assert labels[0] != labels[3]


def test_extract_cluster_names_returns_dict():
    labels = np.array([0, 0, 1, 1, -1])
    texts = [
        "python machine learning tutorial",
        "deep learning neural networks python",
        "recipe cooking dinner pasta",
        "italian pasta recipe tomato",
        "random noise text",
    ]
    names = extract_cluster_names(labels, texts)
    assert 0 in names
    assert 1 in names
    assert -1 not in names
    assert isinstance(names[0], str)
    assert isinstance(names[1], str)


def test_average_intra_cluster_similarity_single_member():
    embeddings = np.array([[1.0, 0.0], [0.0, 1.0]])
    assert average_intra_cluster_similarity(embeddings, [0]) == 0.0
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd scripts/moc_pipeline && python -m pytest tests/test_clustering.py -v
```

Expected: `test_cluster_notes_groups_similar_notes` FAIL (current code uses `AgglomerativeClustering` on raw embeddings, but tests now pass a distance matrix).

- [ ] **Step 3: Rewrite clustering.py**

Replace `scripts/moc_pipeline/clustering.py` entirely:

```python
from __future__ import annotations

import numpy as np
from collections import Counter
from sklearn.feature_extraction.text import TfidfVectorizer
import hdbscan


def _strip_frontmatter(text: str) -> str:
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            return text[end + 3:].strip()
    return text


def cluster_notes(
    distance_matrix: np.ndarray,
    min_cluster_size: int = 2,
    min_samples: int = 1,
) -> np.ndarray:
    """
    Run HDBSCAN on a precomputed (n x n) distance matrix.
    Returns label array: -1 = noise/singleton.
    """
    n = len(distance_matrix)
    if n < 3:
        return np.arange(n)

    # Ensure symmetry and zero diagonal (floating point safety)
    D = (distance_matrix + distance_matrix.T) / 2.0
    np.fill_diagonal(D, 0.0)
    D = np.clip(D, 0.0, 1.0)

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric="precomputed",
    )
    labels: np.ndarray = clusterer.fit_predict(D)
    return labels


def extract_cluster_names(
    labels: np.ndarray,
    texts: list[str],
    n_keywords: int = 3,
) -> dict[int, str]:
    """TF-IDF top keywords per cluster."""
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
        names[label] = " / ".join(w.title() for w in top_words) if top_words else f"Cluster {label}"
    return names


def average_intra_cluster_similarity(
    embeddings: np.ndarray,
    member_indices: list[int],
) -> float:
    """Confidence = mean pairwise cosine similarity among cluster members."""
    if len(member_indices) < 2:
        return 0.0
    vecs = embeddings[member_indices]
    sim_matrix = vecs @ vecs.T
    n = len(member_indices)
    total = (sim_matrix.sum() - n) / (n * (n - 1))
    return float(total)
```

- [ ] **Step 4: Run tests**

```bash
cd scripts/moc_pipeline && python -m pytest tests/test_clustering.py -v
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/moc_pipeline/clustering.py scripts/moc_pipeline/tests/test_clustering.py
git commit -m "feat: replace AgglomerativeClustering with HDBSCAN using precomputed distance matrix"
```

---

## Task 5: Wire composite distance matrix into pipeline.py

**Files:**
- Modify: `scripts/moc_pipeline/pipeline.py`

Now `cluster_notes` takes a distance matrix instead of raw embeddings. We build it in `main()` by fusing:

- `semantic_D` (from embeddings: `1 - cosine_similarity`)
- `temporal_D` (from `features.temporal_distance_matrix`)
- `graph_D` (from `features.graph_distance_matrix`)
- `tag_D` (from `features.tag_distance_matrix`)

Weights: semantic=0.50, temporal=0.20, graph=0.20, tags=0.10. These are configurable constants at the top of `pipeline.py`.

- [ ] **Step 1: Add integration test to test_pipeline.py**

Append to `scripts/moc_pipeline/tests/test_pipeline.py`:

```python
def test_main_end_to_end():
    """Full pipeline with 5 notes: 3 clustered, 2 filtered."""
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        # Two semantically similar Python notes
        _write(root, "python1.md", "---\ntype: note\ntitle: Python Basics\ntags: python\nmodified: 1713000000000\n---\nPython is a programming language.")
        _write(root, "python2.md", "---\ntype: note\ntitle: Python Advanced\ntags: python\nmodified: 1713000100000\n---\nAdvanced Python topics include decorators and generators.")
        _write(root, "python3.md", "---\ntype: note\ntitle: Python Libraries\ntags: python\nmodified: 1713000200000\n---\nNumPy and Pandas are popular Python libraries.")
        # Should be excluded
        _write(root, "journal1.md", "---\ntype: journal\ntitle: My Day\n---\nToday was fine.")
        _write(root, "todo1.md", "---\ntype: todo\ntitle: Buy groceries\n---\n- [ ] milk")
        import json, sys
        # Run the pipeline
        sys.argv = ["pipeline.py", str(root)]
        import pipeline
        pipeline.main(str(root))
        out = json.loads((root / ".moc_clusters.json").read_text())
        assert out["version"] == 1
        # All member note_ids must exclude journal1 and todo1
        all_member_ids = {m["note_id"] for c in out["clusters"] for m in c["members"]}
        assert "journal1" not in all_member_ids
        assert "todo1" not in all_member_ids
```

- [ ] **Step 2: Run to see the test fail (pipeline still uses old 2-tuple)**

```bash
cd scripts/moc_pipeline && python -m pytest tests/test_pipeline.py::test_main_end_to_end -v
```

Expected: FAIL.

- [ ] **Step 3: Update pipeline.py to build composite distance matrix**

Replace the `main()` function and add imports at the top of `scripts/moc_pipeline/pipeline.py`:

Add near the top (after existing imports):
```python
from features import temporal_distance_matrix, graph_distance_matrix, tag_distance_matrix

# Dimension weights — must sum to 1.0
WEIGHT_SEMANTIC = 0.50
WEIGHT_TEMPORAL = 0.20
WEIGHT_GRAPH    = 0.20
WEIGHT_TAGS     = 0.10
```

Replace `main()`:

```python
def main(notes_root_arg: str) -> None:
    notes_root = Path(notes_root_arg).resolve()
    if not notes_root.is_dir():
        print(f"Error: {notes_root} is not a directory", file=sys.stderr)
        sys.exit(1)

    print(f"Loading notes from {notes_root}...")
    note_ids, texts, metas = load_notes(notes_root)
    if len(note_ids) < 3:
        print(f"Only {len(note_ids)} notes found — need at least 3 to cluster.")
        sys.exit(0)
    print(f"Found {len(note_ids)} notes.")

    print("Generating embeddings...")
    embeddings = generate_embeddings(texts)

    print("Building distance matrices...")
    import numpy as np
    from sklearn.metrics.pairwise import cosine_distances
    semantic_D   = cosine_distances(embeddings)
    temporal_D   = temporal_distance_matrix(metas)
    graph_D      = graph_distance_matrix(note_ids, metas)
    tag_D        = tag_distance_matrix(metas)

    composite_D = (
        WEIGHT_SEMANTIC * semantic_D
        + WEIGHT_TEMPORAL * temporal_D
        + WEIGHT_GRAPH    * graph_D
        + WEIGHT_TAGS     * tag_D
    )

    print("Clustering...")
    labels = cluster_notes(composite_D)
    cluster_names = extract_cluster_names(labels, texts)

    output = build_output(note_ids, labels, cluster_names, embeddings)
    out_path = notes_root / OUTPUT_FILENAME
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(output['clusters'])} clusters to {out_path}")
```

- [ ] **Step 4: Run all tests**

```bash
cd scripts/moc_pipeline && python -m pytest tests/ -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/moc_pipeline/pipeline.py
git commit -m "feat: fuse semantic, temporal, graph, and tag distances for HDBSCAN clustering"
```

---

## Task 6: Smoke test with real notes

**Files:** None (manual verification step)

- [ ] **Step 1: Run the pipeline against a real notes directory**

```bash
cd scripts/moc_pipeline && python pipeline.py ~/path/to/your/notes
```

Expected: output like:
```
Loading notes from /path/to/notes...
Found 42 notes.
Generating embeddings...
Building distance matrices...
Clustering...
Wrote 7 clusters to /path/to/notes/.moc_clusters.json
```

No journals or todos should appear as cluster members.

- [ ] **Step 2: Inspect output**

```bash
python -c "
import json
data = json.loads(open('/path/to/notes/.moc_clusters.json').read())
for c in data['clusters'][:3]:
    print(c['name'], '—', len(c['members']), 'members, confidence', c['confidence'])
    for m in c['members'][:3]:
        print('  ', m['note_id'])
"
```

Verify: clusters are thematically coherent, no `journal` or `todo` note IDs appear.

---

## Self-Review Checklist

**Spec coverage:**
- [x] Remove journals and todos from pipeline — Task 2
- [x] Switch to HDBSCAN — Task 4
- [x] Cluster on semantic similarity — Task 5 (`WEIGHT_SEMANTIC * cosine_distances(embeddings)`)
- [x] Cluster on temporal proximity — Tasks 3, 5
- [x] Cluster on graph links (wiki-style) — Tasks 3, 5
- [x] Cluster on tags — Tasks 3, 5

**JSON output schema unchanged** — `build_output` signature is identical; TypeScript consumer (`clusterService.ts`) needs no changes.

**Type consistency across tasks:**
- `load_notes` returns `(list[str], list[str], list[dict])` — used consistently in Tasks 2 and 5.
- `cluster_notes(distance_matrix: np.ndarray)` — consistent between Tasks 4 and 5.
- `metas` dict keys `title`, `type`, `tags`, `modified`, `wikilinks` — consistent between Tasks 2 and 3.
