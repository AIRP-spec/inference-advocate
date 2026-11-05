#!/usr/bin/env python3
"""Hindsight (not a run): the Amendment 3 bar applied to the P3-2 H1 within-run artifacts s45-s49 on the data-v8 val they
were scored on. In-distribution = a val positive whose group (contrastGroup|kind|family) has data-v8 train rows.
  hindsight_a3_p32.py DATA_V8_DIR COMPOSITION RAW_AVG_ROOT > p32-hindsight-a3.json   (counts only, no item text)"""
import hashlib, json, sys
from pathlib import Path
here = Path(__file__).resolve().parent
sys.path.insert(0, str(here)); sys.path.insert(0, str(here.parent / "p32"))
import p32_val as V
from airp_v3.compose import load_composition, COMPOSITION_2A_SHA256
from option_b_a3 import evaluate_a3
d8, compp, root = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
comp = load_composition(compp, expect_sha256=COMPOSITION_2A_SHA256)
rows = V.load_val_derived(d8 / "val.jsonl", comp)
grp = lambda r: r.get("contrastGroup") or r.get("kind") or r.get("family")
train_groups = {grp(json.loads(l)) for l in open(d8 / "train.jsonl") if l.strip()}
hate = [r["id"] for r in rows if r.get("kind") == "hate-eliminationist"]
meta = {"val_n": len(rows), "val_sha256": hashlib.sha256((d8 / "val.jsonl").read_bytes()).hexdigest(),
        "hate_eliminationist_val_ids": hate, "classes": {}}
for c in V.SAFETY:
    pos = [r for r in rows if c in r["expect_derived"]]
    meta["classes"][c] = {"in_distribution_ids": [r["id"] for r in pos if grp(r) in train_groups],
                          "held_out_ids": [r["id"] for r in pos if grp(r) not in train_groups],
                          "val_pos": len(pos), "val_neg": len(rows) - len(pos),
                          "held_out_groups": sorted({grp(r) for r in pos if grp(r) not in train_groups})}
seeds = [45, 46, 47, 48, 49]
models = {f"artifact-s{s}": V.score_model(root / f"p32-H1-s{s}" / f"avg-p32-H1-s{s}-ge2.0", rows, comp) for s in seeds}
res = evaluate_a3({"n_val": len(rows), "val_sha256": meta["val_sha256"], "models": models}, meta, seeds)
res["hindsight_note"] = "P3-2 H1 artifacts on data-v8 val; not a run; in-distribution sets as listed"
res["in_distribution_counts"] = {c: len(m["in_distribution_ids"]) for c, m in meta["classes"].items()}
res["held_out_groups"] = {c: m["held_out_groups"] for c, m in meta["classes"].items()}
json.dump(res, sys.stdout, indent=1); print()
