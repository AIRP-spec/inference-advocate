"""Shared text normalisation and hashing for the protected-content checks.

Nothing in this module reads protected files by itself. It only turns text into
hashes, so the same rules are used when fingerprints are built (by an operator
who holds the protected files) and when v3 files are scanned (by anyone).
"""
from __future__ import annotations

import hashlib
import re

NGRAM = 8          # word n-gram length used for partial-copy detection
SHORT_MIN = 4      # protected items shorter than NGRAM words but at least this long are matched whole

_WORD = re.compile(r"[a-z0-9']+")
ID_TOKEN = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{3,}[A-Za-z0-9]")


def words(text: str) -> list[str]:
    return _WORD.findall(text.lower())


def h(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def id_hash(item_id: str) -> str:
    return h("id:" + item_id)


def gram_hash(ws: list[str]) -> str:
    return h(f"g{len(ws)}:" + " ".join(ws))


def grams(ws: list[str], n: int):
    for i in range(0, len(ws) - n + 1):
        yield ws[i:i + n]


def sha256_file(path) -> str:
    d = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            d.update(chunk)
    return d.hexdigest()
