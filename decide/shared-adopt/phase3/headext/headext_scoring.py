"""Shared scoring helpers for the head extension (V2 pairs, V2 P/R, V3 guard). Val only; never v3 / v3-safety.
Prediction records: infer_raw_shared schema {id, logits: {qid: [...]}}; decision = p(yes) >= 0.5 per noul head
(T=1), stance = argmax (p32_val.decide). Exact binomial arithmetic, no scipy."""
from __future__ import annotations

import json, math
from pathlib import Path

STANCES = ["conveys_method", "depicts", "describes", "encourages", "endorses"]


def softmax(z):
    m = max(z); e = [math.exp(x - m) for x in z]; s = sum(e)
    return [x / s for x in e]


def p_yes(rec, q):
    return softmax(rec["logits"][q])[1]


def on(rec, q):
    return p_yes(rec, q) >= 0.5


def stance(rec):
    st = rec["logits"]["stance"]
    return STANCES[max(range(len(st)), key=lambda i: st[i])]


def load_preds(path):
    out = {}
    for line in open(path, encoding="utf-8"):
        if line.strip():
            o = json.loads(line); out[o["id"]] = o
    return out


def load_rows(path):
    return [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]


def v2_required(n_pairs: int) -> int:
    """Signed rule (t213u item 4): >= 5 of 6 at exactly six pairs; >= floor(0.83 n) above six; fewer than six = invalid."""
    if n_pairs < 6:
        raise ValueError(f"{n_pairs} pairs < the signed minimum of six")
    return 5 if n_pairs == 6 else (83 * n_pairs) // 100


def binom_cdf(k, n, p):
    if p <= 0:
        return 1.0
    if p >= 1:
        return 1.0 if k >= n else 0.0
    return sum(math.comb(n, i) * p ** i * (1 - p) ** (n - i) for i in range(k + 1))


def cp_upper(k: int, n: int, alpha: float = 0.05) -> float:
    """Exact one-sided (1-alpha) Clopper-Pearson upper bound: the p with P(X <= k | n, p) = alpha (1.0 when k = n)."""
    if n == 0:
        return float("nan")
    if k >= n:
        return 1.0
    if k == 0:
        return 1 - alpha ** (1 / n)
    lo, hi = k / n, 1.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if binom_cdf(k, n, mid) > alpha:
            lo = mid
        else:
            hi = mid
    return hi


def median(xs):
    s = sorted(xs); n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
