"""Resolve the protected held-out files (v2 suite and the v1-207 subset) from a
private location that is NOT inside this public repository.

Lookup order: --protected-dir argument, then $AIRP_PROTECTED_DIR, then
/root/airp-protected (the operator path on the AIRP VPS).

Every file is checked against a pinned SHA-256 before use. A file with an
unknown hash is refused, so the tool cannot silently run against an edited
suite. Content from these files is never printed by any tool in this package.
"""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from .fingerprint import sha256_file

DEFAULT_DIR = "/root/airp-protected"

# name -> accepted SHA-256 pins (content of the items is identical across the v2 pins;
# 82f8e720 differs from 6c7b30e1 only in one violence boundary item's expect/notes, ADR 2026-10-18 suite amendment).
PINS = {
    "held-out-suite.v2.json": {
        "82f8e720fbb1d146a93a09da86484dada04561cffd85293be435c0ed0000ad77": "v2 amended (suite amendment ADR 2026-10-18, PR #33)",
        "6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4": "v2 as on main before the amendment",
    },
    "held-out-suite.v1.json": {
        "f577129b649a36e1914c74772d023790429cf46a7acb4db58046b9c859ad8014": "v1-207 historical subset",
    },
}


class ProtectedError(RuntimeError):
    pass


def _repo_root(start: Path) -> Path | None:
    try:
        out = subprocess.run(["git", "-C", str(start), "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, check=True).stdout.strip()
        return Path(out).resolve() if out else None
    except Exception:
        return None


def resolve_dir(explicit: str | None = None) -> Path:
    d = Path(explicit or os.environ.get("AIRP_PROTECTED_DIR") or DEFAULT_DIR).resolve()
    if not d.is_dir():
        raise ProtectedError(f"protected dir not found: {d} (set --protected-dir or AIRP_PROTECTED_DIR)")
    v3_root = Path(__file__).resolve().parents[1]
    for root in filter(None, (_repo_root(v3_root), v3_root)):
        if d == root or root in d.parents:
            raise ProtectedError("protected dir must be outside the public repository checkout")
    return d


def load(explicit: str | None = None, pins_override: dict | None = None):
    """Return (items, pins_used). items = list of {"id", "content", "source"}.

    pins_override is for the unit tests (synthetic protected files) only.
    """
    d = resolve_dir(explicit)
    items, used = [], {}
    for name, pins in (pins_override or PINS).items():
        p = d / name
        if not p.is_file():
            raise ProtectedError(f"missing protected file {name} in {d}")
        digest = sha256_file(p)
        if digest not in pins:
            raise ProtectedError(f"{name}: unpinned sha256 {digest}; refusing")
        used[name] = digest
        suite = json.loads(p.read_text("utf-8"))
        for it in suite["items"]:
            items.append({"id": it["id"], "content": it.get("content", ""), "source": name})
    return items, used
