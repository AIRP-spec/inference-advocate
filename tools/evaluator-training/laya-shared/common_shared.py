"""Shared constants/helpers for the 3b pack (data pins, tokenization, targets)."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

BASE_MODEL_ID = "convaiinnovations/laya"
BASE_REVISION = "55cf4c4ebb4ebe31b2550e8bdf3bd21b99753851"
WEIGHT_SHA256 = "891102d372688fc2a094dac56a384bc537b87c63f21f9f3dac0be2b7cbc8d86c"
QUESTIONS_CANONICAL_SHA256 = "a2e7b5b36615e3b720258c1363819e7c976fac64d998e7d19a0899a5d41ef7a7"
TRAIN_SHA256 = "4cdf51b69997f21a5f5aa36c69be9a9b62671962ec32442b5525164dc00497e5"
VAL_SHA256 = "467899841b930e798277eca70bb46fb344e7f2223ee661f5372352593f5e9b2f"
SUITE_SHA256 = "6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4"
MAX_LEN = 1024


def sha256_file(p) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def load_jsonl(p):
    return [json.loads(l) for l in open(p, encoding="utf-8") if l.strip()]


def assert_questions_pin(qs):
    canon = json.dumps(qs, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    got = hashlib.sha256(canon.encode("utf-8")).hexdigest()
    if got != QUESTIONS_CANONICAL_SHA256:
        raise SystemExit(f"questions canonical sha mismatch: {got}")


def state_text(row) -> str:
    return row.get("state") or row.get("content") or ""


def encode_response(tok, state, max_len: int = MAX_LEN):
    """[CLS] response [SEP], response tokenized as laya.build_sequence does (mask token -> space, no specials)."""
    from laya.common import encode_text, serialize_state

    ids = encode_text(tok, serialize_state(state).replace(tok.mask_token, " "), add_special_tokens=False)["input_ids"]
    room = max(0, max_len - 2)
    return [tok.cls_token_id] + ids[:room] + [tok.sep_token_id], len(ids)


def gold_target(qid, q, row):
    """Same hard targets as the deciding run (airp_laya_common.gold_target_for_question)."""
    if q["type"] == "choice":
        keys = list(q["criteria"].keys())
        t = [1.0 if k == row.get("stance") else 0.0 for k in keys]
        if sum(t) == 0:
            t = [1.0 / len(keys)] * len(keys)
        return t
    pos = set(row.get("objects") or []) | set(row.get("qualifiers") or [])
    return [0.0, 1.0] if qid in pos else [1.0, 0.0]
