from __future__ import annotations

import numpy as np
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
