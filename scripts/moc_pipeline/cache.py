from __future__ import annotations
import json
import subprocess
from pathlib import Path
from typing import Callable, Any
import numpy as np

_CACHE_DIR = ".moc_cache"
_HEAD_FILE = "head.txt"
_EMBEDDINGS_FILE = "embeddings.json"

def load_head(notes_root: Path) -> str | None:
    path = notes_root / _CACHE_DIR / _HEAD_FILE
    return path.read_text(encoding="utf-8").strip() if path.exists() else None

def save_head(notes_root: Path, commit: str) -> None:
    d = notes_root / _CACHE_DIR
    d.mkdir(exist_ok=True)
    (d / _HEAD_FILE).write_text(commit, encoding="utf-8")

def load_embeddings(notes_root: Path) -> dict[str, list[float]]:
    path = notes_root / _CACHE_DIR / _EMBEDDINGS_FILE
    if not path.exists(): return {}
    try: return json.loads(path.read_text(encoding="utf-8"))
    except: return {}

def save_embeddings(notes_root: Path, data: dict[str, list[float]]) -> None:
    d = notes_root / _CACHE_DIR
    d.mkdir(exist_ok=True)
    (d / _EMBEDDINGS_FILE).write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")

def get_changed_paths(notes_root: Path, since_commit: str | None, until_commit: str) -> list[str]:
    if since_commit is None:
        result = subprocess.run(["git", "-C", str(notes_root), "ls-tree", "-r", "--name-only", until_commit], capture_output=True, text=True, check=True)
    else:
        result = subprocess.run(["git", "-C", str(notes_root), "diff", "--name-only", since_commit, until_commit], capture_output=True, text=True, check=True)
    return [p for p in result.stdout.splitlines() if p.endswith(".md")]

def cached_embeddings(notes: dict[str, str], notes_root: Path, current_head: str, generate_fn: Callable[[list[str]], np.ndarray]) -> dict[str, list[float]]:
    last_head = load_head(notes_root)
    cache = load_embeddings(notes_root)
    changed = set(get_changed_paths(notes_root, last_head, current_head))
    
    # Clean up cache for deleted files
    for path in list(cache.keys()):
        if path not in notes: del cache[path]

    # Embed changed files
    to_embed = [(path, text) for path, text in notes.items() if path in changed or path not in cache]
    if to_embed:
        paths, texts = zip(*to_embed)
        new_embs = generate_fn(list(texts))
        for path, emb in zip(paths, new_embs):
            cache[path] = emb.tolist()

    save_embeddings(notes_root, cache)
    save_head(notes_root, current_head)
    return cache
