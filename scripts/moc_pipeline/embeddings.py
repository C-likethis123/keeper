from __future__ import annotations
import numpy as np
from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def generate_embeddings(texts: list[str]) -> np.ndarray:
    """Return L2-normalised embeddings, shape (len(texts), 384)."""
    return get_model().encode(texts, normalize_embeddings=True, show_progress_bar=True)
