import sys
from pathlib import Path
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from clustering import cluster_notes, extract_cluster_names, average_intra_cluster_similarity


def test_cluster_notes_returns_array_of_correct_length():
    n = 6
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
