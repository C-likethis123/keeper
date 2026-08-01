import sys
from pathlib import Path
import tempfile
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))
from pipeline import _preserve_super_cluster_ids, load_notes


def _write(tmp: Path, name: str, content: str) -> None:
    (tmp / name).write_text(content, encoding="utf-8")


def test_load_notes_excludes_journals_and_todos():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        _write(root, "note.md", "---\ntype: note\ntitle: A note\n---\nHello")
        _write(root, "journal.md", "---\ntype: journal\ntitle: Daily\n---\nToday...")
        _write(root, "todo.md", "---\ntype: todo\ntitle: Buy milk\n---\n- [ ] milk")
        _write(root, "resource.md", "---\ntype: resource\ntitle: Some URL\n---\nhttps://example.com")
        ids, texts, metas = load_notes(root)
        titles = [m["title"] for m in metas]
        assert "A note" in titles
        assert "Some URL" in titles
        assert "Daily" not in titles
        assert "Buy milk" not in titles
        assert len(ids) == 2


def test_load_notes_returns_metadata():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        _write(root, "note.md", "---\ntype: note\ntitle: Hello\ntags: foo, bar\nmodified: 1713000000000\n---\nContent with [[Other Note]]")
        ids, texts, metas = load_notes(root)
        assert len(ids) == 1
        m = metas[0]
        assert m["title"] == "Hello"
        assert m["tags"] == ["foo", "bar"]
        assert m["modified"] == 1713000000000
        assert "Other Note" in m["wikilinks"]


def test_load_notes_uses_frontmatter_id_and_filename_fallback():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        (root / "pages").mkdir()
        _write(root / "pages", "named.md", "---\nid: stable-id\ntitle: Named\n---\nBody")
        _write(root / "pages", "fallback.md", "---\ntitle: Fallback\n---\nBody")

        ids, _, _ = load_notes(root)

        assert ids == ["fallback", "stable-id"]


def test_load_notes_block_style_tags():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        _write(root, "note.md", "---\ntype: note\ntitle: Tagged\ntags:\n  - python\n  - ml\n---\nBody text")
        ids, texts, metas = load_notes(root)
        assert metas[0]["tags"] == ["python", "ml"]


def test_load_notes_excludes_journal_with_bom():
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        content = "\ufeff---\ntype: journal\ntitle: Daily\n---\nToday..."
        _write(root, "journal.md", content)
        ids, texts, metas = load_notes(root)
        assert len(ids) == 0


def test_preserve_super_cluster_ids_updates_parent_links():
    clusters = [
        {
            "id": "child-1",
            "parent_id": "generated-super",
            "members": [{"note_id": "a"}, {"note_id": "b"}],
        },
        {
            "id": "child-2",
            "parent_id": "generated-super",
            "members": [{"note_id": "c"}],
        },
    ]
    super_clusters = [
        {
            "id": "generated-super",
            "child_cluster_ids": ["child-1", "child-2"],
        }
    ]

    _preserve_super_cluster_ids(
        super_clusters,
        clusters,
        {"accepted-super": {"a", "b", "c"}},
    )

    assert super_clusters[0]["id"] == "accepted-super"
    assert {cluster["parent_id"] for cluster in clusters} == {"accepted-super"}


def test_main_end_to_end():
    """Full pipeline with 5 notes: 3 clustered, 2 filtered."""
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        # Two semantically similar Python notes
        _write(root, "python1.md", "---\ntype: note\ntitle: Python Basics\ntags: python\nmodified: 1713000000000\n---\nPython is a programming language.")
        _write(root, "python2.md", "---\ntype: note\ntitle: Python Advanced\ntags: python\nmodified: 1713000100000\n---\nAdvanced Python topics include decorators and generators.")
        _write(root, "python3.md", "---\ntype: note\ntitle: Python Libraries\ntags: python\nmodified: 1713000200000\n---\nNumPy and Pandas are popular Python libraries.")
        # Should be excluded
        _write(root, "journal1.md", "---\ntype: journal\ntitle: My Day\n---\nToday was fine.")
        _write(root, "todo1.md", "---\ntype: todo\ntitle: Buy groceries\n---\n- [ ] milk")
        import json, sys
        import pipeline

        embeddings = np.array([
            [1.0, 0.0, 0.0],
            [0.99, 0.01, 0.0],
            [0.98, 0.02, 0.0],
        ])
        with patch.object(
            pipeline,
            "_lazy_imports",
            return_value=(
                lambda _texts: embeddings,
                None,
                lambda _distances: np.array([0, 0, 0]),
                lambda _labels, _texts: {0: "Python"},
                lambda _clusters, _embeddings, _ids, _texts: [],
            ),
        ):
            pipeline.main(str(root))
        out = json.loads((root / ".moc_clusters.json").read_text())
        assert out["version"] == 2
        # All member note_ids must exclude journal1 and todo1
        all_member_ids = {m["note_id"] for c in out["clusters"] for m in c["members"]}
        assert "journal1" not in all_member_ids
        assert "todo1" not in all_member_ids
