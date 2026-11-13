"""t241u/t242u: G7 incremental select is deterministic, train-only, generation-order, val untouched."""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import headext_g7_incremental as g  # noqa: E402
import headext_slots as hs  # noqa: E402

assert g.SPEC_SHA == hs.sha256_file(hs.SPEC)
assert g.G7_END == 235 and g.G7X_START == 232


def _pair(sample, arm, register, length):
    unit = f"hx-cr-direct-vs-fiction-{sample:03d}"
    return {
        "id": f"{unit}-{arm.lower()}",
        "kind": f"cr-direct-vs-fiction-{arm.lower()}",
        "contrastGroup": "cr-direct-vs-fiction",
        "arm": arm,
        "pair_unit": unit,
        "content": f"synth-{unit}-{arm}",
        "provenance": {
            "kind_spec": "cr-direct-vs-fiction",
            "register": register,
            "length": length,
            "cell": f"{register}/{length}",
            "sample": sample,
        },
    }


def _single(sample, register, length):
    i = f"hx-cr-resource-in-fiction-{sample:03d}"
    return {
        "id": i,
        "kind": "cr-resource-in-fiction",
        "content": f"synth-{i}",
        "provenance": {
            "kind_spec": "cr-resource-in-fiction",
            "register": register,
            "length": length,
            "cell": f"{register}/{length}",
            "sample": sample,
        },
    }


def _rows_for(pair_samples, single_samples=None, pair_cells=None, single_cells=None):
    pair_cells = pair_cells or g.PAIR_CELLS
    single_cells = single_cells or g.SINGLE_CELLS
    rows = []
    for n, i in enumerate(pair_samples):
        pr, pln = pair_cells[n % len(pair_cells)]
        for arm in "AB":
            rows.append(_pair(i, arm, pr, pln))
    if single_samples is None:
        single_samples = range(g.G7_START, 232)  # original 32 singles, 200-231
    for n, i in enumerate(single_samples):
        sr, sln = single_cells[n % len(single_cells)]
        rows.append(_single(i, sr, sln))
    return rows


def test_g7_select_fills_24_in_generation_order_and_logs_surplus():
    # full g7 surplus (200-231) all complete
    rows = _rows_for(range(200, 232))
    sel = g.select_g7(rows)
    assert not sel["shortfall"]
    assert len(sel["pair_units"]) == 24
    assert len(sel["single_ids"]) == 24
    assert len(sel["train"]) == 24 * 2 + 24
    assert sel["val"] == []
    assert sel["n_pair_complete"] == 32 and sel["n_single"] == 32
    # generation order: first 24 samples, not cell RR
    assert sel["pair_units"] == [f"hx-cr-direct-vs-fiction-{i:03d}" for i in range(200, 224)]
    assert sel["pair_surplus_units"] == [f"hx-cr-direct-vs-fiction-{i:03d}" for i in range(224, 232)]
    assert sel["single_ids"] == [f"hx-cr-resource-in-fiction-{i:03d}" for i in range(200, 224)]
    assert sel["single_surplus_ids"] == [f"hx-cr-resource-in-fiction-{i:03d}" for i in range(224, 232)]


def test_g7x_fills_shortfall_in_generation_order():
    """23 complete units from 200-231 plus 4 extra (232-235): take 23 + 232, surplus 233-235."""
    # drop 9 units like the real t241u filter (207,209,210,213,222,224,227,228,230) → 23 remain
    broken = {207, 209, 210, 213, 222, 224, 227, 228, 230}
    pair_samples = [i for i in range(200, 232) if i not in broken] + [232, 233, 234, 235]
    # one single dropped (228) as in the real filter
    single_samples = [i for i in range(200, 232) if i != 228]
    rows = _rows_for(pair_samples, single_samples)
    sel = g.select_g7(rows)
    assert not sel["shortfall"]
    assert len(sel["pair_units"]) == 24
    assert sel["n_pair_complete"] == 27  # 23 + 4
    expected = [f"hx-cr-direct-vs-fiction-{i:03d}" for i in range(200, 232) if i not in broken] + [
        "hx-cr-direct-vs-fiction-232"
    ]
    assert sel["pair_units"] == expected
    assert sel["pair_surplus_units"] == [
        "hx-cr-direct-vs-fiction-233",
        "hx-cr-direct-vs-fiction-234",
        "hx-cr-direct-vs-fiction-235",
    ]
    assert len(sel["single_ids"]) == 24
    assert "hx-cr-resource-in-fiction-228" not in sel["single_ids"]
    assert "hx-cr-resource-in-fiction-228" not in sel["single_surplus_ids"]


def test_g7_select_after_unpaired_arm_skips_unit():
    rows = _rows_for(range(200, 232))
    rows = [r for r in rows if not (r.get("pair_unit") == "hx-cr-direct-vs-fiction-200" and r["arm"] == "B")]
    sel = g.select_g7(rows)
    assert not sel["shortfall"]
    assert "hx-cr-direct-vs-fiction-200" not in sel["pair_units"]
    assert sel["pair_units"][0] == "hx-cr-direct-vs-fiction-201"
    assert sel["n_unpaired_pair"] == 1
    # still 24: 31 complete minus this one, take 201-224
    assert sel["pair_units"] == [f"hx-cr-direct-vs-fiction-{i:03d}" for i in range(201, 225)]


def test_g7_shortfall_when_fewer_than_24_complete():
    rows = _rows_for(range(200, 223))  # 23 complete, no g7x
    sel = g.select_g7(rows)
    assert "cr-direct-vs-fiction" in sel["shortfall"]
    assert sel["shortfall"]["cr-direct-vs-fiction"]["train_got"] == 23
