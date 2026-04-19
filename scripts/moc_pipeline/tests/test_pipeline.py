import sys
from pathlib import Path
import tempfile

sys.path.insert(0, str(Path(__file__).parent.parent))
from pipeline import load_notes


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
