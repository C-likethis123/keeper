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
