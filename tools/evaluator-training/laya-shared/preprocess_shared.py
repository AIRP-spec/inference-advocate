#!/usr/bin/env python3
"""3b preprocessing: one training item per response (not per question). Writes train_items.pt / val_items.pt."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import torch
from huggingface_hub import snapshot_download
from transformers import AutoTokenizer

from common_shared import (BASE_MODEL_ID, BASE_REVISION, MAX_LEN, TRAIN_SHA256, VAL_SHA256, WEIGHT_SHA256,
                           assert_questions_pin, encode_response, gold_target, load_jsonl, sha256_file, state_text)
from shared_model import KMAX, question_spec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", type=Path, default=Path("data"))
    ap.add_argument("--out-dir", type=Path, default=Path("preprocessed"))
    ap.add_argument("--model-dir", type=Path, default=None)
    ap.add_argument("--cache-dir", type=Path, default=None)
    ap.add_argument("--max-rows", type=int, default=None)
    ap.add_argument("--skip-sha-check", action="store_true", help="smoke tests with a fake snapshot only")
    a = ap.parse_args()
    a.out_dir.mkdir(parents=True, exist_ok=True)
    qs = json.load(open(a.data_dir / "laya-questions.json"))
    assert_questions_pin(qs)
    for name, pin in (("train.jsonl", TRAIN_SHA256), ("val.jsonl", VAL_SHA256)):
        got = sha256_file(a.data_dir / name)
        if got != pin:
            raise SystemExit(f"{name} sha mismatch {got}")
    if a.model_dir is None:
        kw = {"repo_id": BASE_MODEL_ID, "revision": BASE_REVISION}
        tok_env = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
        if tok_env:
            kw["token"] = tok_env
        if a.cache_dir:
            kw["cache_dir"] = str(a.cache_dir)
        a.model_dir = Path(snapshot_download(**kw))
    got = sha256_file(a.model_dir / "model.safetensors")
    if got != WEIGHT_SHA256 and not a.skip_sha_check:
        raise SystemExit(f"base weight sha mismatch {got}")
    from laya.agent import _fix_tokenizer_config
    _fix_tokenizer_config(str(a.model_dir))
    tok = AutoTokenizer.from_pretrained(str(a.model_dir / "tokenizer"))
    qids, qtypes, widths = question_spec(qs)
    meta = {"model_dir": str(a.model_dir.resolve()), "weight_sha256": got, "qids": qids, "qtypes": qtypes, "widths": widths,
            "max_len": MAX_LEN, "train_sha256": TRAIN_SHA256, "val_sha256": VAL_SHA256}
    for split in ("train", "val"):
        rows = load_jsonl(a.data_dir / f"{split}.jsonl")
        if a.max_rows:
            rows = rows[: a.max_rows]
        items, ntrunc, t0 = [], 0, time.time()
        for r in rows:
            ids, ntok = encode_response(tok, state_text(r), MAX_LEN)
            ntrunc += int(ntok > MAX_LEN - 2)
            tgt = torch.zeros(len(qids), KMAX)
            for j, qid in enumerate(qids):
                t = gold_target(qid, qs[qid], r)
                s = sum(t)
                t = [v / s for v in t]
                tgt[j, : len(t)] = torch.tensor(t)
            items.append({"ids": ids, "target": tgt, "row_id": r.get("id")})
        torch.save(items, a.out_dir / f"{split}_items.pt")
        meta[f"{split}_items"] = len(items)
        meta[f"{split}_truncated"] = ntrunc
        meta[f"{split}_mean_len"] = sum(len(i["ids"]) for i in items) / max(1, len(items))
        print(f"[{split}] {len(items)} items, truncated {ntrunc}, mean len {meta[f'{split}_mean_len']:.1f} ({time.time()-t0:.1f}s)")
    json.dump(meta, open(a.out_dir / "preprocess-meta.json", "w"), indent=2)
    print("PREPROCESS_DONE")


if __name__ == "__main__":
    main()
