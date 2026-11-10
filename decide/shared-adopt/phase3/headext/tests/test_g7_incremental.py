"""t241u: G7 incremental select is deterministic, train-only, and leaves val untouched."""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import headext_g7_incremental as g  # noqa: E402
import headext_slots as hs  # noqa: E402

# packer pins the live v10-7 spec
assert g.SPEC_SHA == hs.sha256_file(hs.SPEC)


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


def _full_surplus():
    rows = []
    # same cell cycle as build_g7_jobs
    pair_cells = g.PAIR_CELLS
    single_cells = g.SINGLE_CELLS
    for n, i in enumerate(range(g.G7_START, g.G7_END + 1)):
        pr, pln = pair_cells[n % len(pair_cells)]
        for arm in "AB":
            rows.append(_pair(i, arm, pr, pln))
        sr, sln = single_cells[n % len(single_cells)]
        rows.append(_single(i, sr, sln))
    return rows


def test_g7_select_fills_24_and_24_with_declared_mix():
    sel = g.select_g7(_full_surplus())
    assert not sel["shortfall"]
    assert len(sel["pair_units"]) == 24
    assert len(sel["single_ids"]) == 24
    assert len(sel["train"]) == 24 * 2 + 24
    assert sel["val"] == []
    assert sel["n_pair_complete"] == 32 and sel["n_single"] == 32
    assert sel["n_unpaired_pair"] == 0
    # 24 through a 5-slot 2:4:4 cycle -> 5 / 10 / 9
    assert sel["pair_cell_mix"] == {
        "clinical/short": 5, "colloquial/short": 10, "colloquial/medium": 9,
    }
    assert sel["single_cell_mix"] == {
        "clinical/short": 6, "clinical/medium": 6,
        "colloquial/short": 6, "colloquial/medium": 6,
    }
    assert all(g.G7_START <= int(u.rsplit("-", 1)[-1]) <= g.G7_END for u in sel["pair_units"])
    # first 24 pair samples in cycle order are 200-223
    samples = [int(u.rsplit("-", 1)[-1]) for u in sel["pair_units"]]
    assert samples == list(range(200, 224))


def test_g7_select_after_drops_still_fills():
    rows = _full_surplus()
    # drop two complete pair units and two singles, all in well-stocked cells
    drop = {
        "hx-cr-direct-vs-fiction-201",  # colloquial/short
        "hx-cr-direct-vs-fiction-202",  # colloquial/short
        "hx-cr-resource-in-fiction-200",
        "hx-cr-resource-in-fiction-201",
    }
    rows = [r for r in rows if r.get("pair_unit") not in drop and r["id"] not in drop]
    sel = g.select_g7(rows)
    assert not sel["shortfall"]
    assert len(sel["pair_units"]) == 24 and len(sel["single_ids"]) == 24
    assert "hx-cr-direct-vs-fiction-201" not in sel["pair_units"]
    assert "hx-cr-resource-in-fiction-200" not in sel["single_ids"]
    # unpaired arm is reserve, not selected
    rows2 = _full_surplus()
    rows2 = [r for r in rows2 if not (r.get("pair_unit") == "hx-cr-direct-vs-fiction-200" and r["arm"] == "B")]
    sel2 = g.select_g7(rows2)
    assert not sel2["shortfall"]
    assert "hx-cr-direct-vs-fiction-200" not in sel2["pair_units"]
    assert sel2["n_unpaired_pair"] == 1


def test_g7_shortfall_when_surplus_exhausted():
    rows = _full_surplus()
    # keep only 20 complete pair units
    keep_pair = {f"hx-cr-direct-vs-fiction-{i:03d}" for i in range(200, 220)}
    rows = [r for r in rows if (r.get("pair_unit") in keep_pair) or r["kind"] == "cr-resource-in-fiction"]
    sel = g.select_g7(rows)
    assert "cr-direct-vs-fiction" in sel["shortfall"]
    assert sel["shortfall"]["cr-direct-vs-fiction"]["train_got"] == 20
