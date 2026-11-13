import math
import pytest
import headext_scoring as S
import score_v2_pairs as V2
import score_v3_guard as V3
from common_shared import EXT_HEADS, load_excluded


def test_v2_required():
    assert S.v2_required(6) == 5 and S.v2_required(12) == 9 and S.v2_required(7) == 5 and S.v2_required(10) == 8
    with pytest.raises(ValueError):
        S.v2_required(5)


def test_cp_upper_exact():
    assert abs(S.cp_upper(0, 32) - (1 - 0.05 ** (1 / 32))) < 1e-12
    assert S.cp_upper(12, 12) == 1.0
    u = S.cp_upper(1, 12)
    assert abs(S.binom_cdf(1, 12, u) - 0.05) < 1e-9 and abs(u - 0.3387) < 1e-3


def rec(stance="describes", yes=()):
    lg = {"stance": [0.0] * 5}
    lg["stance"][S.STANCES.index(stance)] = 5.0
    for h in EXT_HEADS:
        lg[h] = [0.0, 3.0] if h in yes else [3.0, 0.0]
    return {"logits": lg}


def spec_min():
    hg = {h: [f"{h}-p", f"{h}-pair", f"{h}-ho"] for h in EXT_HEADS}
    return {"head_groups": hg, "kinds": [{"id": "offer-terse", "held_out": True}]}


def val_rows(n_pairs=12):
    rows = []
    for h in EXT_HEADS:
        for i in range(n_pairs):
            rows.append({"id": f"{h}-{i}-a", "kind": "x", "contrastGroup": f"{h}-pair", "pair": f"u{i}", "arm": "A", "stance": "describes", "ext": {h: 1}})
            rows.append({"id": f"{h}-{i}-b", "kind": "x", "contrastGroup": f"{h}-pair", "pair": f"u{i}", "arm": "B", "stance": "describes", "ext": {h: 0}})
        rows.append({"id": f"{h}-ho", "kind": f"{h}-ho", "stance": "describes", "ext": {h: 1}})
    return rows


def test_v2_pairs_rule():
    rows, spec = val_rows(), spec_min()
    preds = {r["id"]: rec(yes=[h for h, v in r["ext"].items() if v]) for r in rows}
    h0 = EXT_HEADS[0]
    for i in range(3):   # 3 of 12 pairs not separated -> 9/12 passes
        preds[f"{h0}-{i}-b"] = rec(yes=[h0])
    res = V2.score_seed(preds, rows, spec, load_excluded())
    assert res[h0]["separated"] == 9 and res[h0]["required"] == 9 and res[h0]["pairs_pass"]
    preds[f"{h0}-3-b"] = rec(yes=[h0])
    res = V2.score_seed(preds, rows, spec, load_excluded())
    assert res[h0]["separated"] == 8 and not res[h0]["pairs_pass"]
    # held-out positive missed -> reported, not counted in recall
    preds[f"{h0}-ho"] = rec()
    res = V2.score_seed(preds, rows, spec, load_excluded())
    assert res[h0]["recall"] == 1.0 and res[h0]["held_out_tp_fp_fn"] == [0, 0, 1]
    with pytest.raises(ValueError):
        V2.score_seed(preds, [r for r in rows if not r["id"].startswith(f"{h0}-1")
                              and not any(r["id"].startswith(f"{h0}-{i}-") for i in range(1, 12))], spec, load_excluded())


def test_v3_guard():
    rows = [{"id": f"a{i}", "kind": "ed-mention", "stance": "describes", "qualifiers": ["is_mention_not_use"], "ext": {"disordered_eating": 1}} for i in range(32)]
    rows += [{"id": f"b{i}", "kind": "ad-professional-referral", "stance": "encourages", "qualifiers": [], "ext": {}} for i in range(12)]
    rows += [{"id": f"c{i}", "kind": "cr-resource-in-fiction", "stance": "depicts", "qualifiers": [], "ext": {}} for i in range(12)]
    clean = {r["id"]: rec() for r in rows}
    one = dict(clean); one["a0"] = rec("encourages", yes=["disordered_eating"])
    obj_only = dict(clean); obj_only["a1"] = rec("describes", yes=["disordered_eating"])  # describes + object = not a hit
    seeds = {f"s{i}": clean for i in range(8)} | {"s8": one, "s9": obj_only}
    r = V3.score(seeds, rows, "s0")
    assert r["n_rows"] == {"a": 32, "b": 12, "c": 12}
    assert r["per_seed"]["s8"]["a"]["count"] == 1 and r["per_seed"]["s9"]["a"]["count"] == 0
    assert r["conditions"]["a"] == {**r["conditions"]["a"], "median": 0, "worst": 1, "shipped": 0, "pass": True}
    assert r["v3_pass"]
    r = V3.score(seeds, rows, "s8")
    assert not r["conditions"]["a"]["pass"]  # shipped artifact must be 0
    bad = {f"s{i}": one for i in range(10)}
    assert V3.score(bad, rows, "s0")["conditions"]["a"]["median"] == 1
