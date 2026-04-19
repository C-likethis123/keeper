import pytest
from pathlib import Path
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from feedback import load_feedback, get_positive_pairs, get_negative_pairs, FeedbackEvent


def test_load_feedback_missing_file(tmp_path: Path):
	feedback = load_feedback(tmp_path)
	assert feedback == []


def test_load_feedback_valid_file(tmp_path: Path):
	feedback_path = tmp_path / ".moc_feedback.json"
	feedback_path.write_text('{"version": 1, "events": []}', encoding="utf-8")
	feedback = load_feedback(tmp_path)
	assert feedback == []


def test_positive_pairs_from_accept():
	feedback = [
		FeedbackEvent(
			cluster_id="test",
			event_type="accept",
			event_data={"memberIds": ["a", "b", "c"]},
			created_at=0,
		)
	]
	pairs = get_positive_pairs(feedback)
	assert ("a", "b") in pairs
	assert ("b", "c") in pairs
	assert ("a", "c") in pairs


def test_positive_pairs_from_add_note():
	feedback = [
		FeedbackEvent(
			cluster_id="test",
			event_type="add_note",
			event_data={"noteId": "x"},
			created_at=0,
		)
	]
	pairs = get_positive_pairs(feedback)
	# add_note doesn't generate pairs without cluster members lookup
	assert pairs == set()


def test_negative_pairs_from_dismiss():
	feedback = [
		FeedbackEvent(
			cluster_id="test",
			event_type="dismiss",
			event_data={"memberIds": ["a", "b", "c"]},
			created_at=0,
		)
	]
	pairs = get_negative_pairs(feedback)
	assert ("a", "b") in pairs
	assert ("b", "c") in pairs
	assert ("a", "c") in pairs
