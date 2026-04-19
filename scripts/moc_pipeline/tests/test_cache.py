import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
import numpy as np
from scripts.moc_pipeline.cache import cached_embeddings

@patch("scripts.moc_pipeline.cache.get_changed_paths")
@patch("scripts.moc_pipeline.cache.load_embeddings")
@patch("scripts.moc_pipeline.cache.load_head")
@patch("scripts.moc_pipeline.cache.save_embeddings")
@patch("scripts.moc_pipeline.cache.save_head")
def test_cached_embeddings_incremental(mock_save_head, mock_save_embeddings, mock_load_head, mock_load_embeddings, mock_get_changed):
    mock_load_head.return_value = "old_hash"
    mock_load_embeddings.return_value = {"note1.md": [0.1], "note2.md": [0.2]}
    mock_get_changed.return_value = ["note2.md"]
    
    notes = {"note1.md": "text1", "note2.md": "new_text2"}
    
    def mock_gen(texts):
        return np.array([[0.3]])

    res = cached_embeddings(notes, Path("."), "new_hash", mock_gen)
    
    assert res["note1.md"] == [0.1]
    assert res["note2.md"] == [0.3]
    mock_save_embeddings.assert_called()
    mock_save_head.assert_called_with(Path("."), "new_hash")
