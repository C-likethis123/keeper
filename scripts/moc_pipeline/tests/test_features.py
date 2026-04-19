import sys
from pathlib import Path
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from features import (
    temporal_distance_matrix,
    graph_distance_matrix,
    tag_distance_matrix,
)


def test_temporal_same_time():
    metas = [{"modified": 1000000}, {"modified": 1000000}]
    D = temporal_distance_matrix(metas)
    assert D.shape == (2, 2)
    assert D[0, 1] == pytest.approx(0.0)


def test_temporal_cap_at_one():
    ms_31_days = 31 * 24 * 3600 * 1000
    metas = [{"modified": 0}, {"modified": ms_31_days}]
    D = temporal_distance_matrix(metas)
    assert D[0, 1] == pytest.approx(1.0)


def test_temporal_none_is_neutral():
    metas = [{"modified": None}, {"modified": 1000000}]
    D = temporal_distance_matrix(metas)
    assert D[0, 1] == pytest.approx(0.5)


def test_graph_direct_link():
    note_ids = ["alpha", "beta", "gamma"]
    metas = [
        {"wikilinks": ["beta"], "title": "alpha"},
        {"wikilinks": [], "title": "beta"},
        {"wikilinks": [], "title": "gamma"},
    ]
    D = graph_distance_matrix(note_ids, metas)
    assert D[0, 1] == pytest.approx(0.0)   # directly linked = min distance
    assert D[0, 2] > D[0, 1]               # gamma not linked


def test_graph_no_links_all_max():
    note_ids = ["a", "b", "c"]
    metas = [
        {"wikilinks": [], "title": "a"},
        {"wikilinks": [], "title": "b"},
        {"wikilinks": [], "title": "c"},
    ]
    D = graph_distance_matrix(note_ids, metas)
    assert D[0, 1] == pytest.approx(1.0)


def test_tag_identical_tags():
    metas = [{"tags": ["foo", "bar"]}, {"tags": ["bar", "foo"]}]
    D = tag_distance_matrix(metas)
    assert D[0, 1] == pytest.approx(0.0)


def test_tag_disjoint_tags():
    metas = [{"tags": ["foo"]}, {"tags": ["bar"]}]
    D = tag_distance_matrix(metas)
    assert D[0, 1] == pytest.approx(1.0)


def test_tag_no_tags_is_neutral():
    metas = [{"tags": []}, {"tags": ["foo"]}]
    D = tag_distance_matrix(metas)
    assert D[0, 1] == pytest.approx(0.5)
