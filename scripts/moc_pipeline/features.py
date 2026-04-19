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
    title_to_idx: dict[str, int] = {}
    for i, meta in enumerate(metas):
        t = meta.get("title", "").lower().strip()
        if t:
            title_to_idx[t] = i
        title_to_idx[note_ids[i].lower()] = i

    adj: list[set[int]] = [set() for _ in range(n)]
    for i, meta in enumerate(metas):
        for link in meta.get("wikilinks", []):
            key = link.lower().strip()
            j = id_to_idx.get(key) or title_to_idx.get(key)
            if j is not None and j != i:
                adj[i].add(j)
                adj[j].add(i)

    raw = np.full((n, n), n + 1, dtype=float)
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

    max_finite = raw[raw < n + 1].max() if (raw < n + 1).any() else 1.0
    if max_finite <= 1.0:
        max_finite = 1.0
    # Map: distance 1 (direct link) -> 0.0, distance max_finite -> (max_finite-1)/max_finite < 1.0
    # Unreachable -> 1.0
    D = np.where(raw >= n + 1, 1.0, (raw - 1.0) / max_finite)
    D = np.clip(D, 0.0, 1.0)
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
