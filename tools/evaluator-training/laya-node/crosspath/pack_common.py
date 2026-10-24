"""Padding-free packing of one response's 17 question rows into one session.run (Task 3 step 2).
Rows are bin-packed first-fit-decreasing into bins of capacity = longest row of the item (so no bin is
longer than the padded layout's sequence). Inside a bin, rows are separate segments: the packed export
masks attention across segments (block-diagonal) and restarts position ids per segment, so every real
token sees exactly the context it sees in the padded layout. Pad tokens form their own segment."""
import numpy as np

# S2c cost model (ms ~ A*bins*cap + B*bins*cap^2), least-squares fit on S2 per-item VPS timings (R^2 0.95).
# Only the ratio B/A matters for choosing cap. Speed-only layout choice: outputs are layout-invariant.
COST_A, COST_B = 0.854, 0.001606

def _ffd_bins(lens, cap):
    fill = []
    for l in sorted(lens, reverse=True):
        for b in range(len(fill)):
            if fill[b] + l <= cap:
                fill[b] += l; break
        else:
            fill.append(l)
    return len(fill)

def choose_cap(lens, mode="max"):
    m = max(lens)
    if mode == "max":
        return m
    # costmin: cap in [m, 2m] minimising predicted cost; ties -> smallest cap
    return min(range(m, 2 * m + 1), key=lambda k: (COST_A * _ffd_bins(lens, k) * k + COST_B * _ffd_bins(lens, k) * k * k, k))

def pack_rows(items, pad_id, cap_mode="max"):
    n = len(items)
    lens = [len(it["ids"]) for it in items]
    cap = choose_cap(lens, cap_mode)
    order = sorted(range(n), key=lambda i: (-lens[i], i))
    bins, fill = [], []
    for i in order:
        for b in range(len(bins)):
            if fill[b] + lens[i] <= cap:
                bins[b].append(i); fill[b] += lens[i]; break
        else:
            bins.append([i]); fill.append(lens[i])
    B, L = len(bins), cap
    k = max(len(it["markers"]) for it in items)
    ids = np.full((B, L), pad_id, dtype=np.int64)
    seg = np.full((B, L), -1, dtype=np.int64)      # -1 = pad
    pos = np.zeros((B, L), dtype=np.int64)
    mpos = np.zeros((n, k), dtype=np.int64)          # flat index b*L + offset + marker
    mmask = np.zeros((n, k), dtype=bool)
    rstart = np.zeros((n,), dtype=np.int64)          # flat index of each row's [CLS]
    for b, members in enumerate(bins):
        off = 0
        for i in members:
            l = lens[i]
            ids[b, off:off + l] = items[i]["ids"]; seg[b, off:off + l] = i; pos[b, off:off + l] = np.arange(l)
            m = items[i]["markers"]; mpos[i, :len(m)] = [b * L + off + x for x in m]; mmask[i, :len(m)] = True
            rstart[i] = b * L + off
            off += l
        if off < L:
            pos[b, off:] = np.arange(L - off)
    qt = np.array([it["qtype"] for it in items], dtype=np.int64)
    return {"input_ids": ids, "seg_ids": seg, "position_ids": pos, "marker_pos": mpos, "marker_mask": mmask,
            "row_start": rstart, "qtype": qt}
