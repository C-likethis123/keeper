from __future__ import annotations
import re
import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.feature_extraction.text import TfidfVectorizer


def _strip_frontmatter(text: str) -> str:
    """Remove YAML frontmatter block if present."""
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            return text[end + 3 :].strip()
    return text


def cluster_notes(
    embeddings: np.ndarray,
    distance_threshold: float = 0.40,
) -> np.ndarray:
    """
    Return label array (length = len(embeddings)).
    Uses cosine distance with average linkage.
    Clusters with only 1 member get label -1 (noise) after filtering.
    """
    if len(embeddings) < 3:
        return np.arange(len(embeddings))

    model = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=distance_threshold,
        metric="cosine",
        linkage="average",
    )
    labels: np.ndarray = model.fit_predict(embeddings)

    # Mark singleton clusters as noise
    from collections import Counter
    counts = Counter(labels.tolist())
    for i, label in enumerate(labels):
        if counts[label] < 2:
            labels[i] = -1

    return labels


def extract_cluster_names(
    labels: np.ndarray,
    texts: list[str],
    n_keywords: int = 3,
) -> dict[int, str]:
    """
    For each unique non-noise label, compute TF-IDF over member note bodies
    and join the top `n_keywords` terms as the cluster name.
    """
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
        if top_words:
            names[label] = " / ".join(w.title() for w in top_words)
        else:
            names[label] = f"Cluster {label}"
    return names


def average_intra_cluster_similarity(
    embeddings: np.ndarray,
    member_indices: list[int],
) -> float:
    """Confidence = mean pairwise cosine similarity among cluster members."""
    if len(member_indices) < 2:
        return 0.0
    vecs = embeddings[member_indices]
    # Embeddings are already L2-normalised, so dot product = cosine similarity
    sim_matrix = vecs @ vecs.T
    n = len(member_indices)
    # Sum off-diagonal
    total = (sim_matrix.sum() - n) / (n * (n - 1))
    return float(total)
