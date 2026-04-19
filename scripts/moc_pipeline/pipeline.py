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

import sys
import re as _re
from pathlib import Path

# Ensure the script's directory is on sys.path for sibling module imports
sys.path.insert(0, str(Path(__file__).parent))

import json
import uuid

_FRONTMATTER_RE = _re.compile(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?")
_WIKILINK_RE = _re.compile(r"\[\[(.+?)\]\]")
_EXCLUDED_TYPES = {"journal", "todo"}

OUTPUT_FILENAME = ".moc_clusters.json"
MIN_CLUSTER_CONFIDENCE = 0.30


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
        # Skip hidden directories (e.g. .git, .keeper)
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


def _lazy_imports():
    """Lazy-import heavy dependencies so load_notes can be imported without numpy."""
    from embeddings import generate_embeddings as _gen
    from clustering import (
        average_intra_cluster_similarity as _aic,
        cluster_notes as _cn,
        extract_cluster_names as _ecn,
    )
    return _gen, _aic, _cn, _ecn


def build_output(
    note_ids: list[str],
    labels,
    cluster_names: dict[int, str],
    embeddings,
    average_intra_cluster_similarity_fn,
) -> dict:
    from collections import defaultdict

    member_map: dict[int, list[int]] = defaultdict(list)
    for i, label in enumerate(labels.tolist()):
        if label != -1:
            member_map[int(label)].append(i)

    clusters = []
    for label, member_indices in member_map.items():
        confidence = average_intra_cluster_similarity_fn(embeddings, member_indices)
        if confidence < MIN_CLUSTER_CONFIDENCE:
            continue
        centroid = embeddings[member_indices].mean(axis=0)
        members = [
            {"note_id": note_ids[i], "score": round(float(centroid @ embeddings[i]), 4)}
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

    generate_embeddings, average_intra_cluster_similarity, cluster_notes, extract_cluster_names = _lazy_imports()

    print(f"Loading notes from {notes_root}...")
    note_ids, texts, metas = load_notes(notes_root)
    if len(note_ids) < 3:
        print(f"Only {len(note_ids)} notes found — need at least 3 to cluster.")
        sys.exit(0)
    print(f"Found {len(note_ids)} notes.")

    print("Generating embeddings...")
    embeddings = generate_embeddings(texts)

    print("Clustering...")
    labels = cluster_notes(embeddings)
    cluster_names = extract_cluster_names(labels, texts)

    output = build_output(note_ids, labels, cluster_names, embeddings, average_intra_cluster_similarity)
    out_path = notes_root / OUTPUT_FILENAME
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(output['clusters'])} clusters to {out_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <notes-root>")
        sys.exit(1)
    main(sys.argv[1])
