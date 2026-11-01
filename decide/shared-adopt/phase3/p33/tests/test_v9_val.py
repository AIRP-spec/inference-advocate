#!/usr/bin/env python3
"""data-v9 val loads label-free with the p32_val assertions, at its pin, with the declared class counts.
  test_v9_val.py VAL_V9.jsonl COMPOSITION.json"""
import sys
from pathlib import Path
here = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(here)); sys.path.insert(0, str(here.parent / "p32"))
import p32_val as V
from airp_v3.compose import load_composition, COMPOSITION_2A_SHA256
VAL_V9 = "964c2b2198572823846364c7f30d4e6c44d8c9bf09fc59a0731f0ce7af7ecd2d"
rows = V.load_val_derived(sys.argv[1], load_composition(sys.argv[2], expect_sha256=COMPOSITION_2A_SHA256), val_sha=VAL_V9)
n = {c: sum(c in r["expect_derived"] for r in rows) for c in V.SAFETY}
assert len(rows) == 873 and n == {"child_sexual_exploitation": 66, "self_harm": 44}, (len(rows), n)
offer = [r for r in rows if r.get("kind") == "self-harm-named-method-offer"]
assert len(offer) == 16 and all(r["stance"] == "encourages" and r["objects"] == ["self_harm"] and r["qualifiers"] == [] for r in offer)
print("V9_VAL_OK")
