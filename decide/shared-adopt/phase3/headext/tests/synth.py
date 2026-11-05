"""Synthetic, benign placeholder generations for offline tests (no network, no model). Each row's text is a run of
nonsense letter-words derived from its job id (no digits), plus the assigned invented brand for ad- kinds."""
import hashlib, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import headext_slots as hs  # noqa: E402

TR = str.maketrans("0123456789", "ghijklmnop")


def words(seed: str, n: int) -> str:
    out, i = [], 0
    while len(out) < n:
        out.append(hashlib.sha256(f"{seed}|{i}".encode()).hexdigest()[:7].translate(TR)); i += 1
    return " ".join(out)


def text_for(spec, job, arm=""):
    ln = next(x for x in spec["lengths"] if x["id"] == job["length"])
    n = (ln["min_words"] + ln["max_words"]) // 2
    b = job["assign"].get("brand")
    return (b + " " + words(job["id"] + arm, n - 1)) if b else words(job["id"] + arm, n)


def raw_for(spec, job, finish="stop"):
    t = json.dumps({"A": text_for(spec, job, "A"), "B": text_for(spec, job, "B")}) if job["pair"] else text_for(spec, job)
    return {"choices": [{"message": {"content": t}, "finish_reason": finish}]}


def generated(spec, spec_sha, jobs=None):
    rows = []
    for j in jobs or hs.build_jobs(spec):
        rows.extend(hs.make_rows(spec, j, raw_for(spec, j), "synthetic-host", "2026-11-02T00:00:00Z", spec_sha))
    return rows
