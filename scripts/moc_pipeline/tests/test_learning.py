import pytest
import numpy as np
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from learning import adjust_distance_weights, apply_pairwise_constraints


def test_adjust_distance_weights():
	note_id_to_index = {"a": 0, "b": 1}
	semantic_D = np.array([[0, 0.8], [0.8, 0]])
	temporal_D = np.array([[0, 0.2], [0.2, 0]])
	graph_D = np.array([[0, 0.5], [0.5, 0]])
	tag_D = np.array([[0, 0.3], [0.3, 0]])

	positive_pairs = {("a", "b")}  # High semantic distance, should reduce semantic weight

	weights = adjust_distance_weights(
		positive_pairs,
		set(),
		note_id_to_index,
		semantic_D,
		temporal_D,
		graph_D,
		tag_D,
		{"semantic": 0.5, "temporal": 0.2, "graph": 0.2, "tags": 0.1},
	)

	assert weights["semantic"] < 0.5  # Should be reduced
	assert abs(sum(weights.values()) - 1.0) < 0.01  # Should sum to 1


def test_apply_pairwise_constraints():
	D = np.array([[0, 0.5], [0.5, 0]])
	note_id_to_index = {"a": 0, "b": 1}

	adjusted = apply_pairwise_constraints(
		D,
		{("a", "b")},  # Positive pair
		set(),
		note_id_to_index,
		alpha=0.3,
	)

	assert adjusted[0, 1] < 0.5  # Distance reduced


def test_apply_pairwise_constraints_negative():
	D = np.array([[0, 0.5], [0.5, 0]])
	note_id_to_index = {"a": 0, "b": 1}

	adjusted = apply_pairwise_constraints(
		D,
		set(),
		{("a", "b")},  # Negative pair
		note_id_to_index,
		alpha=0.3,
	)

	assert adjusted[0, 1] > 0.5  # Distance increased
