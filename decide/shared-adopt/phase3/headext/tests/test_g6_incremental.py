"""t237u: G6 incremental select is deterministic, pool-separated, and does not re-split old units."""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import headext_g6_incremental as g  # noqa: E402
import headext_slots as hs  # noqa: E402

# v10-7 supersedes v10-6; G6 kind fields remain. Production packer still pins v10-6.
g.SPEC_SHA = hs.sha256_file(hs.SPEC)


def _row(sample, arm, register, length, pair=None):
    unit = pair or f"hx-op-own-vs-reported-{sample:03d}"
    return {
        "id": f"{unit}-{arm.lower()}",
        "kind": f"op-own-vs-reported-{arm.lower()}",
        "contrastGroup": "op-own-vs-reported",
        "arm": arm,
        "pair_unit": unit,
        "content": f"synth-{unit}-{arm}",
        "provenance": {
            "kind_spec": "op-own-vs-reported",
            "register": register,
            "length": length,
            "cell": f"{register}/{length}",
            "sample": sample,
        },
    }


def test_g6_select_pools_and_counts():
    spec, _ = hs.load_pinned(hs.SPEC, g.SPEC_SHA)
    k = next(x for x in spec["kinds"] if x["id"] == "op-own-vs-reported")
    rows = []
    # train pool 55-101 all short, registers cycling like build_g6_jobs
    regs = k["registers"]
    for i in range(g.G6_TRAIN_START, g.G6_TRAIN_END + 1):
        reg = regs[i % len(regs)]
        for arm in "AB":
            rows.append(_row(i, arm, reg, "short"))
    # val pool 102-117 declared cells
    cells = hs.cells_for(spec, k)
    for i in range(g.G6_VAL_START, g.G6_VAL_END + 1):
        reg, ln = cells[i % len(cells)]
        for arm in "AB":
            rows.append(_row(i, arm, reg, ln))
    sel = g.select_g6(rows)
    assert not sel["shortfall"]
    assert len(sel["train_units"]) == 36
    assert len(sel["val_units"]) == 12
    assert len(sel["train"]) == 72 and len(sel["val"]) == 24
    assert sel["train_f6_short_units"] == 36
    assert all(55 <= int(u.rsplit("-", 1)[-1]) <= 101 for u in sel["train_units"])
    assert all(102 <= int(u.rsplit("-", 1)[-1]) <= 117 for u in sel["val_units"])
    # first 36 train by cell RR, lowest sample: no later sample before an earlier one in the same cell is skipped
    assert sel["train_cell_mix"] == {"clinical/short": 12, "colloquial/short": 12, "terse/short": 12}


def test_g6_select_after_drops_still_fills_and_stays_in_pool():
    # drop the same val units the real filter dropped, still 12 val
    rows_ok_ids = None
    spec, _ = hs.load_pinned(hs.SPEC, g.SPEC_SHA)
    k = next(x for x in spec["kinds"] if x["id"] == "op-own-vs-reported")
    rows = []
    regs = k["registers"]
    drop_units = {73, 74, 84, 93, 102}  # complete units dropped in the real G6 filter
    drop_arms = {("116", "A"), ("117", "A")}
    for i in range(g.G6_TRAIN_START, g.G6_TRAIN_END + 1):
        if i in drop_units:
            continue
        reg = regs[i % len(regs)]
        for arm in "AB":
            rows.append(_row(i, arm, reg, "short"))
    cells = hs.cells_for(spec, k)
    for i in range(g.G6_VAL_START, g.G6_VAL_END + 1):
        if i in drop_units:
            continue
        reg, ln = cells[i % len(cells)]
        for arm in "AB":
            if (f"{i}", arm) in drop_arms:
                continue
            rows.append(_row(i, arm, reg, ln))
    sel = g.select_g6(rows)
    assert not sel["shortfall"]
    assert len(sel["train_units"]) == 36 and len(sel["val_units"]) == 12
    assert sel["val_units"] == [
        "hx-op-own-vs-reported-108", "hx-op-own-vs-reported-109", "hx-op-own-vs-reported-110",
        "hx-op-own-vs-reported-111", "hx-op-own-vs-reported-103", "hx-op-own-vs-reported-104",
        "hx-op-own-vs-reported-105", "hx-op-own-vs-reported-106", "hx-op-own-vs-reported-107",
        "hx-op-own-vs-reported-112", "hx-op-own-vs-reported-113", "hx-op-own-vs-reported-114",
    ]
    assert sel["val_f6_short_units"] == 4
