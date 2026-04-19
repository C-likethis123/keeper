from __future__ import annotations
import numpy as np
from collections import defaultdict
from typing import Any


def adjust_distance_weights(
	positive_pairs: set[tuple[str, str]],
	negative_pairs: set[tuple[str, str]],
	note_id_to_index: dict[str, int],
	semantic_D: np.ndarray,
	temporal_D: np.ndarray,
	graph_D: np.ndarray,
	tag_D: np.ndarray,
	current_weights: dict[str, float],
) -> dict[str, float]:
	"""
	Adjust feature weights based on feedback.
	If positive pairs have high distance in a dimension, decrease its weight.
	If negative pairs have low distance in a dimension, decrease its weight.
	"""
	weights = current_weights.copy()
	learning_rate = 0.1  # Small adjustment per iteration

	# Compute average distances for positive and negative pairs per dimension
	dim_matrices = {
		"semantic": semantic_D,
		"temporal": temporal_D,
		"graph": graph_D,
		"tags": tag_D,
	}

	for dim_name, matrix in dim_matrices.items():
		pos_distances = []
		neg_distances = []

		for note_a, note_b in positive_pairs:
			if note_a in note_id_to_index and note_b in note_id_to_index:
				i = note_id_to_index[note_a]
				j = note_id_to_index[note_b]
				pos_distances.append(matrix[i, j])

		for note_a, note_b in negative_pairs:
			if note_a in note_id_to_index and note_b in note_id_to_index:
				i = note_id_to_index[note_a]
				j = note_id_to_index[note_b]
				neg_distances.append(matrix[i, j])

		if pos_distances:
			avg_pos_dist = np.mean(pos_distances)
			# If positive pairs are far in this dimension, reduce weight
			if avg_pos_dist > 0.5:
				weights[dim_name] *= 1 - learning_rate

		if neg_distances:
			avg_neg_dist = np.mean(neg_distances)
			# If negative pairs are close in this dimension, reduce weight
			if avg_neg_dist < 0.3:
				weights[dim_name] *= 1 - learning_rate

	# Renormalize to sum to 1.0
	total = sum(weights.values())
	if total > 0:
		weights = {k: v / total for k, v in weights.items()}

	return weights


def apply_pairwise_constraints(
	distance_matrix: np.ndarray,
	positive_pairs: set[tuple[str, str]],
	negative_pairs: set[tuple[str, str]],
	note_id_to_index: dict[str, int],
	alpha: float = 0.3,
) -> np.ndarray:
	"""
	Apply must-link and cannot-link constraints to distance matrix.
	Positive pairs: reduce distance
	Negative pairs: increase distance
	"""
	adjusted_D = distance_matrix.copy()

	for note_a, note_b in positive_pairs:
		if note_a in note_id_to_index and note_b in note_id_to_index:
			i = note_id_to_index[note_a]
			j = note_id_to_index[note_b]
			adjusted_D[i, j] *= 1 - alpha
			adjusted_D[j, i] *= 1 - alpha

	for note_a, note_b in negative_pairs:
		if note_a in note_id_to_index and note_b in note_id_to_index:
			i = note_id_to_index[note_a]
			j = note_id_to_index[note_b]
			adjusted_D[i, j] = min(1.0, adjusted_D[i, j] * (1 + alpha))
			adjusted_D[j, i] = min(1.0, adjusted_D[j, i] * (1 + alpha))

	return adjusted_D


def learn_cluster_naming(
	rename_examples: list[tuple[str, str, str]],
	texts: list[str],
	note_ids: list[str],
	cluster_labels: np.ndarray,
) -> dict[int, str]:
	"""
	Learn better cluster names from rename examples.
	For now, simple heuristic: prefer words from user renames.
	Future: train a seq2seq model.
	"""
	# Extract keywords from user-provided names
	rename_keywords = defaultdict(list)
	for cluster_id, original, new_name in rename_examples:
		words = new_name.lower().split()
		for word in words:
			if len(word) > 2:  # Skip short words
				rename_keywords[word].append(1)

	# Boost these words in TF-IDF
	# This is a placeholder - full implementation would modify extract_cluster_names
	return {}  # Return empty for now, integrate in Task 8
