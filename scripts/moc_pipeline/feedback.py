from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json


@dataclass
class FeedbackEvent:
	cluster_id: str
	event_type: str
	event_data: dict[str, Any] | None
	created_at: int


def load_feedback(notes_root: Path) -> list[FeedbackEvent]:
	"""Load feedback events from .moc_feedback.json if it exists."""
	feedback_path = notes_root / ".moc_feedback.json"
	if not feedback_path.exists():
		return []

	try:
		data = json.loads(feedback_path.read_text(encoding="utf-8"))
		events = data.get("events", [])
		return [
			FeedbackEvent(
				cluster_id=e["clusterId"],
				event_type=e["eventType"],
				event_data=e.get("eventData"),
				created_at=e["createdAt"],
			)
			for e in events
		]
	except Exception as e:
		print(f"Warning: Failed to load feedback: {e}")
		return []


def get_positive_pairs(feedback: list[FeedbackEvent]) -> set[tuple[str, str]]:
	"""
	Extract positive note-pair signals from feedback.
	Returns set of (note_id_a, note_id_b) tuples.
	"""
	positive_pairs = set()

	for event in feedback:
		if event.event_type in ("accept", "add_note"):
			# For accept: all members are positively paired
			if event.event_type == "accept" and event.event_data:
				member_ids = event.event_data.get("memberIds", [])
				for i in range(len(member_ids)):
					for j in range(i + 1, len(member_ids)):
						pair = tuple(sorted([member_ids[i], member_ids[j]]))
						positive_pairs.add(pair)

			# For add_note: pair with all cluster members (need cluster members lookup)
			# This requires cluster_members table access - defer to learning module

	return positive_pairs


def get_negative_pairs(feedback: list[FeedbackEvent]) -> set[tuple[str, str]]:
	"""
	Extract negative note-pair signals from feedback.
	Returns set of (note_id_a, note_id_b) tuples.
	"""
	negative_pairs = set()

	for event in feedback:
		if event.event_type == "dismiss":
			# Dismissed clusters: members are negatively paired
			if event.event_data and "memberIds" in event.event_data:
				member_ids = event.event_data["memberIds"]
				for i in range(len(member_ids)):
					for j in range(i + 1, len(member_ids)):
						pair = tuple(sorted([member_ids[i], member_ids[j]]))
						negative_pairs.add(pair)

		elif event.event_type == "remove_note":
			# Removed note is negatively paired with cluster
			# Requires cluster members lookup
			pass

	return negative_pairs


def get_rename_examples(feedback: list[FeedbackEvent]) -> list[tuple[str, str, str]]:
	"""
	Extract rename examples: (cluster_id, original_name, new_name).
	Used to train naming model.
	"""
	renames = []
	for event in feedback:
		if event.event_type == "rename" and event.event_data:
			original = event.event_data.get("originalName")
			new_name = event.event_data.get("newName")
			if original and new_name:
				renames.append((event.cluster_id, original, new_name))
	return renames


def get_dismissed_cluster_ids(feedback: list[FeedbackEvent]) -> set[str]:
	"""Get set of cluster IDs that were dismissed."""
	return {e.cluster_id for e in feedback if e.event_type == "dismiss"}
