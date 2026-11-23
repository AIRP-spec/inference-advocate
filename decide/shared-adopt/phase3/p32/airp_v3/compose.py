"""Composition: primitives -> AIRP classes.

A line-for-line port of packages/evaluator-local/src/compose-primitives.ts (the
runtime's single source of truth). Semantics kept exactly, including:
  * a node with allOf/anyOf is decided by that list alone (sibling keys ignored);
  * objects/qualifiers in a leaf must ALL be present;
  * negative rule on is_mention_not_use suppresses every class only when
    stance == "describes"; any other negative rule that matches suppresses all;
  * classes with unsupported, no rule, or rule.none are skipped;
  * output order is the order of `classes` in the composition file.

Library:  from airp_v3.compose import compose, load_composition
CLI:      python3 -m airp_v3.compose [--composition FILE] < rows.jsonl > out.jsonl
          rows: {"id", "stance", "objects", "qualifiers"} -> {"id", "classes"}
          python3 -m airp_v3.compose --stance depicts --objects violence_person
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DEFAULT_COMPOSITION = Path(__file__).resolve().parents[1] / "spec" / "composition-2a.json"
COMPOSITION_2A_SHA256 = "59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e"

STANCES = ["conveys_method", "depicts", "describes", "encourages", "endorses"]
OBJECTS = ["violence_person", "self_harm", "sexual_activity", "financial_crime", "intrusion", "weapons", "profanity"]
QUALIFIERS = ["targets_protected_characteristic", "subject_is_minor", "asserts_interior_state", "addresses_own_nature",
              "explicit_register", "exceeds_common_knowledge", "is_mention_not_use", "directed_at_user",
              "untethered_to_content"]


def load_composition(path=None, expect_sha256: str | None = None) -> dict:
    p = Path(path) if path else DEFAULT_COMPOSITION
    raw = p.read_bytes()
    if expect_sha256 is not None:
        import hashlib
        got = hashlib.sha256(raw).hexdigest()
        if got != expect_sha256:
            raise ValueError(f"composition sha256 {got} != expected {expect_sha256}")
    return json.loads(raw.decode("utf-8"))


def _matches(p: dict, cond: dict) -> bool:
    # JS truthiness: an empty list is truthy, so test for presence, not emptiness.
    if cond.get("allOf") is not None:
        return all(_matches(p, c) for c in cond["allOf"])
    if cond.get("anyOf") is not None:
        return any(_matches(p, c) for c in cond["anyOf"])
    if cond.get("stance") and p["stance"] != cond["stance"]:
        return False
    if cond.get("objects") is not None and not all(o in p["objects"] for o in cond["objects"]):
        return False
    if cond.get("qualifiers") is not None and not all(q in p["qualifiers"] for q in cond["qualifiers"]):
        return False
    return True


def _suppressed(p: dict, negative_rules) -> bool:
    for rule in negative_rules or []:
        cond = rule["condition"]
        if _matches(p, cond):
            if "is_mention_not_use" in (cond.get("qualifiers") or []):
                if p["stance"] == "describes":
                    return True
                continue
            return True
    return False


def normalise(prims: dict) -> dict:
    return {"stance": prims.get("stance"), "objects": list(prims.get("objects") or []),
            "qualifiers": list(prims.get("qualifiers") or [])}


def compose(prims: dict, composition: dict | None = None) -> list[str]:
    """Return the list of class names that fire for one primitives verdict."""
    comp = composition if composition is not None else load_composition()
    p = normalise(prims)
    if _suppressed(p, comp.get("negativeRules")):
        return []
    out = []
    for cr in comp["classes"]:
        rule = cr.get("rule")
        if cr.get("unsupported") or rule is None or rule.get("none"):
            continue
        if _matches(p, rule):
            out.append(cr["class"])
    return out


def validate(prims: dict) -> list[str]:
    """Return problems with a primitives verdict (unknown names, bad stance). Empty list = ok."""
    errs = []
    if prims.get("stance") not in STANCES:
        errs.append(f"stance {prims.get('stance')!r} not in {STANCES}")
    errs += [f"unknown object {o!r}" for o in prims.get("objects") or [] if o not in OBJECTS]
    errs += [f"unknown qualifier {q!r}" for q in prims.get("qualifiers") or [] if q not in QUALIFIERS]
    return errs


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--composition", help="composition JSON (default spec/composition-2a.json, sha-checked)")
    ap.add_argument("--stance")
    ap.add_argument("--objects", nargs="*", default=[])
    ap.add_argument("--qualifiers", nargs="*", default=[])
    a = ap.parse_args(argv)
    comp = load_composition(a.composition, None if a.composition else COMPOSITION_2A_SHA256)
    if a.stance:
        print(json.dumps(compose({"stance": a.stance, "objects": a.objects, "qualifiers": a.qualifiers}, comp)))
        return 0
    for line in sys.stdin:
        if not line.strip():
            continue
        r = json.loads(line)
        out = {"id": r.get("id"), "classes": compose(r, comp)}
        errs = validate(r)
        if errs:
            out["warnings"] = errs
        print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
