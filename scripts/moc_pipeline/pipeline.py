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
import os
import re as _re
from pathlib import Path

# Ensure the script's directory is on sys.path for sibling module imports
sys.path.insert(0, str(Path(__file__).parent))

import json
import uuid

from features import temporal_distance_matrix, graph_distance_matrix, tag_distance_matrix
from feedback import (
	load_feedback,
	get_positive_pairs,
	get_negative_pairs,
	get_rename_examples,
	get_dismissed_cluster_ids,
	get_accepted_clusters,
)
from learning import (
	adjust_distance_weights,
	apply_pairwise_constraints,
)

# Dimension weights — must sum to 1.0
WEIGHT_SEMANTIC = 0.50
WEIGHT_TEMPORAL = 0.20
WEIGHT_GRAPH    = 0.20
WEIGHT_TAGS     = 0.10

_FRONTMATTER_RE = _re.compile(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?")
_WIKILINK_RE = _re.compile(r"\[\[(.+?)\]\]")
_EXCLUDED_TYPES = {"journal", "todo"}

OUTPUT_FILENAME = ".moc_clusters.json"
MIN_CLUSTER_CONFIDENCE = 0.30


def _parse_frontmatter_meta(markdown: str) -> dict:
    """Extract type, title, tags, modified, and wikilinks from note."""
    meta: dict = {
        "id": "",
        "type": "note",
        "title": "",
        "tags": [],
        "modified": None,
        "wikilinks": [],
    }
    # Strip BOM and leading blank lines
    markdown = markdown.lstrip('\ufeff').lstrip('\r\n')
    m = _FRONTMATTER_RE.match(markdown)
    if m:
        in_tags_block = False
        for line in m.group(1).splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                in_tags_block = False
                continue
            # YAML list item inside tags block
            if in_tags_block and stripped.startswith("- "):
                tag = stripped[2:].strip()
                if tag:
                    meta["tags"].append(tag)
                continue
            sep = stripped.find(":")
            if sep < 0:
                in_tags_block = False
                continue
            key = stripped[:sep].strip()
            val = stripped[sep + 1:].strip().strip('"').strip("'")
            in_tags_block = False
            if key == "id":
                meta["id"] = val
            elif key == "type":
                meta["type"] = val
            elif key == "title":
                meta["title"] = val
            elif key == "tags":
                if val:
                    meta["tags"] = [t.strip() for t in val.split(",") if t.strip()]
                else:
                    in_tags_block = True  # block-style tags follow
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
        meta["path"] = str(rel) # Relative path WITH extension for cache key
        note_ids.append(meta["id"] or rel.stem)
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
        cluster_super_mocs as _csm,
    )
    return _gen, _aic, _cn, _ecn, _csm

def _current_head(notes_root: Path) -> str:
    import subprocess
    try:
        return subprocess.check_output(
            ["git", "-C", str(notes_root), "rev-parse", "HEAD"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except subprocess.CalledProcessError:
        return "working-tree"


_ACCEPTED_CLUSTER_MATCH_THRESHOLD = 0.5


def _match_accepted_cluster(
    member_note_ids: set[str],
    accepted_clusters: dict[str, set[str]],
) -> str | None:
    """Return accepted cluster ID with strongest qualifying member overlap."""
    best_id = None
    best_score = 0.0
    for cluster_id, accepted_members in accepted_clusters.items():
        union = len(member_note_ids | accepted_members)
        score = len(member_note_ids & accepted_members) / union if union else 0.0
        if score >= _ACCEPTED_CLUSTER_MATCH_THRESHOLD and score > best_score:
            best_id = cluster_id
            best_score = score
    return best_id


def _preserve_super_cluster_ids(
    super_clusters: list[dict],
    clusters: list[dict],
    accepted_super_clusters: dict[str, set[str]],
) -> None:
    """Reuse accepted super-MOC IDs when child-note membership still overlaps."""
    cluster_by_id = {cluster["id"]: cluster for cluster in clusters}
    for super_cluster in super_clusters:
        member_ids = {
            member["note_id"]
            for child_id in super_cluster["child_cluster_ids"]
            for member in cluster_by_id.get(child_id, {}).get("members", [])
        }
        matched_id = _match_accepted_cluster(member_ids, accepted_super_clusters)
        if not matched_id:
            continue
        generated_id = super_cluster["id"]
        super_cluster["id"] = matched_id
        for cluster in clusters:
            if cluster.get("parent_id") == generated_id:
                cluster["parent_id"] = matched_id


def build_output(
    note_ids: list[str],
    labels,
    cluster_names: dict[int, str],
    embeddings,
    accepted_clusters: dict[str, set[str]] | None = None,
) -> dict:
    from collections import defaultdict
    from clustering import average_intra_cluster_similarity

    member_map: dict[int, list[int]] = defaultdict(list)
    for i, label in enumerate(labels.tolist()):
        if label != -1:
            member_map[int(label)].append(i)

    clusters = []
    for label, member_indices in member_map.items():
        confidence = average_intra_cluster_similarity(embeddings, member_indices)
        if confidence < MIN_CLUSTER_CONFIDENCE:
            continue
        centroid = embeddings[member_indices].mean(axis=0)
        member_note_ids = {note_ids[i] for i in member_indices}
        members = [
            {"note_id": note_ids[i], "score": round(float(centroid @ embeddings[i]), 4)}
            for i in member_indices
        ]
        matched_id = _match_accepted_cluster(member_note_ids, accepted_clusters or {})
        clusters.append({
            "id": matched_id if matched_id else str(uuid.uuid4()),
            "name": cluster_names.get(label, f"Cluster {label}"),
            "confidence": round(confidence, 4),
            "members": members,
        })

    # Sort by confidence descending
    clusters.sort(key=lambda c: c["confidence"], reverse=True)
    return {"version": 2, "clusters": clusters, "super_clusters": []}



def main(notes_root_arg: str) -> None:
    notes_root = Path(notes_root_arg).resolve()
    if not notes_root.is_dir():
        print(f"Error: {notes_root} is not a directory", file=sys.stderr)
        sys.exit(1)

    (
        generate_embeddings,
        average_intra_cluster_similarity,
        cluster_notes,
        extract_cluster_names,
        cluster_super_mocs,
    ) = _lazy_imports()

    print(f"Loading notes from {notes_root}...")
    note_ids, texts, metas = load_notes(notes_root)
    if len(note_ids) < 3:
        print(f"Only {len(note_ids)} notes found — need at least 3 to cluster.")
        sys.exit(0)
    print(f"Found {len(note_ids)} notes.")

    print("Loading feedback...")
    feedback = load_feedback(notes_root)
    print(f"Found {len(feedback)} feedback events")

    positive_pairs = get_positive_pairs(feedback)
    negative_pairs = get_negative_pairs(feedback)
    rename_examples = get_rename_examples(feedback)
    dismissed_ids = get_dismissed_cluster_ids(feedback)
    accepted_clusters = get_accepted_clusters(feedback)
    accepted_super_clusters = get_accepted_clusters(feedback, "super_cluster")

    print(f"  Positive pairs: {len(positive_pairs)}")
    print(f"  Negative pairs: {len(negative_pairs)}")
    print(f"  Rename examples: {len(rename_examples)}")
    print(f"  Dismissed clusters: {len(dismissed_ids)}")

    print("Generating embeddings...")
    from cache import cached_embeddings
    import numpy as np
    notes_dict = {meta["path"]: text for meta, text in zip(metas, texts)}
    current_head = _current_head(notes_root)
    emb_cache = cached_embeddings(notes_dict, notes_root, current_head, generate_embeddings)
    embeddings = np.array([emb_cache[meta["path"]] for meta in metas])

    print("Building distance matrices...")
    from sklearn.metrics.pairwise import cosine_distances
    semantic_D   = cosine_distances(embeddings)
    temporal_D   = temporal_distance_matrix(metas)
    graph_D      = graph_distance_matrix(note_ids, metas)
    tag_D        = tag_distance_matrix(metas)

    # Apply feedback learning
    print("Applying feedback learning...")
    note_id_to_index = {note_id: i for i, note_id in enumerate(note_ids)}

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

    print("Clustering...")
    labels = cluster_notes(composite_D)
    cluster_names = extract_cluster_names(labels, texts)

    output = build_output(
        note_ids,
        labels,
        cluster_names,
        embeddings,
        accepted_clusters,
    )
    super_clusters = cluster_super_mocs(output["clusters"], embeddings, note_ids, texts)
    _preserve_super_cluster_ids(
        super_clusters,
        output["clusters"],
        accepted_super_clusters,
    )
    output["super_clusters"] = super_clusters
    out_path = Path(os.environ.get("MOC_OUTPUT_PATH", notes_root / OUTPUT_FILENAME))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(
        f"Wrote {len(output['clusters'])} sub-clusters and "
        f"{len(super_clusters)} super-MOCs to {out_path}"
    )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <notes-root>")
        sys.exit(1)
    main(sys.argv[1])
