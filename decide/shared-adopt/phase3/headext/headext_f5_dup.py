"""D5 (t232u): data-mix change by duplication. Duplicates round(0.22 x n) of the in-distribution CSE-gold train rows
(objects contain sexual_activity and qualifiers contain subject_is_minor; 462 in v10d), chosen by lowest
sha256(salt|id), as new rows with id <id>-d5dup. Works on ids and labels only; never reads or prints row text.
Writes train in place-order (originals unchanged, duplicates appended sorted by id) and a manifest with the before/after share."""
import argparse, hashlib, json
from pathlib import Path

SALT = "airp-headext-rerun-d5"
FACTOR = 1.22


def is_cse_gold(r):
    return "sexual_activity" in r.get("objects", []) and "subject_is_minor" in r.get("qualifiers", [])


def plan(rows):
    cse = [r for r in rows if is_cse_gold(r)]
    n = round((FACTOR - 1) * len(cse))
    pick = sorted(cse, key=lambda r: hashlib.sha256(f"{SALT}|{r['id']}".encode()).hexdigest())[:n]
    dups = [{**r, "id": r["id"] + "-d5dup", "d5_duplicate_of": r["id"]} for r in sorted(pick, key=lambda r: r["id"])]
    return cse, dups


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--train", required=True); ap.add_argument("--manifest", required=True)
    a = ap.parse_args()
    p = Path(a.train); lines = [l for l in p.read_text("utf-8").splitlines() if l.strip()]
    rows = [json.loads(l) for l in lines]
    if any(r.get("d5_duplicate_of") for r in rows): raise SystemExit("already duplicated")
    cse, dups = plan(rows)
    ids = {r["id"] for r in rows}
    assert not ids & {d["id"] for d in dups}
    p.write_text("\n".join(lines + [json.dumps(d, ensure_ascii=False) for d in dups]) + "\n", encoding="utf-8")
    n0, n1 = len(rows), len(rows) + len(dups)
    m = {"rule": "D5 (t232u), duplication only, no new CSE text", "factor": FACTOR, "salt": SALT, "n_cse_gold": len(cse),
         "n_duplicates": len(dups), "train_rows_before": n0, "train_rows_after": n1,
         "cse_share_before": round(len(cse) / n0, 5), "cse_share_after": round((len(cse) + len(dups)) / n1, 5),
         "duplicate_ids": [d["id"] for d in dups], "train_sha256_after": hashlib.sha256(p.read_bytes()).hexdigest()}
    Path(a.manifest).write_text(json.dumps(m, indent=1) + "\n")
    print(json.dumps({k: v for k, v in m.items() if k != "duplicate_ids"}))


if __name__ == "__main__":
    main()
