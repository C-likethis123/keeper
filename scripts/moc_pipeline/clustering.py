from __future__ import annotations

import uuid

import numpy as np
import hdbscan
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_distances


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


def cluster_super_mocs(
    clusters: list[dict],
    all_embeddings: np.ndarray,
    note_ids: list[str],
    texts: list[str],
    n_keywords: int = 3,
) -> list[dict]:
    """Group sub-MOC centroids into named super-MOCs."""
    if len(clusters) < 3:
        return []

    note_id_to_idx = {note_id: index for index, note_id in enumerate(note_ids)}
    centroids = []
    for cluster in clusters:
        member_indices = [
            note_id_to_idx[member["note_id"]]
            for member in cluster["members"]
            if member["note_id"] in note_id_to_idx
        ]
        centroids.append(
            all_embeddings[member_indices].mean(axis=0)
            if member_indices
            else np.zeros(all_embeddings.shape[1])
        )

    centroids_array = np.array(centroids, dtype=float)
    super_labels = cluster_notes(
        cosine_distances(centroids_array),
        min_cluster_size=2,
        min_samples=1,
    )

    stripped = [_strip_frontmatter(text) for text in texts]
    tfidf = None
    feature_names: np.ndarray = np.array([])
    if stripped:
        try:
            vectorizer = TfidfVectorizer(
                max_features=2000,
                stop_words="english",
                max_df=0.85,
                min_df=1,
                ngram_range=(1, 2),
            )
            tfidf = vectorizer.fit_transform(stripped)
            feature_names = vectorizer.get_feature_names_out()
        except ValueError:
            pass

    super_clusters: list[dict] = []
    for super_label in sorted(set(super_labels.tolist())):
        if super_label == -1:
            continue

        child_indices = [
            index for index, label in enumerate(super_labels) if label == super_label
        ]
        child_cluster_ids = [clusters[index]["id"] for index in child_indices]
        super_name = f"Topic {super_label}"
        if tfidf is not None:
            all_member_indices = [
                note_id_to_idx[member["note_id"]]
                for child_index in child_indices
                for member in clusters[child_index]["members"]
                if member["note_id"] in note_id_to_idx
            ]
            if all_member_indices:
                cluster_vector = np.asarray(
                    tfidf[all_member_indices].mean(axis=0)
                ).flatten()
                top_indices = cluster_vector.argsort()[-n_keywords:][::-1]
                top_words = [
                    feature_names[index]
                    for index in top_indices
                    if cluster_vector[index] > 0
                ]
                if top_words:
                    super_name = " / ".join(word.title() for word in top_words)

        child_centroids = centroids_array[child_indices]
        child_count = len(child_indices)
        similarity = child_centroids @ child_centroids.T
        norms = np.linalg.norm(child_centroids, axis=1, keepdims=True)
        norms_outer = np.where(norms @ norms.T == 0, 1.0, norms @ norms.T)
        confidence = float(
            ((similarity / norms_outer).sum() - child_count)
            / (child_count * (child_count - 1))
        )

        super_cluster_id = str(uuid.uuid4())
        super_clusters.append(
            {
                "id": super_cluster_id,
                "name": super_name,
                "confidence": round(max(confidence, 0.0), 4),
                "child_cluster_ids": child_cluster_ids,
            }
        )
        for child_index in child_indices:
            clusters[child_index]["parent_id"] = super_cluster_id

    return super_clusters
