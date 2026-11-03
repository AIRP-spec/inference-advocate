"""Assemble the head-extension training pack (sizing addendum §8; t221u). Files: the pinned pack/ code, average_n.py and
requirements.txt from the P3-3 pack, data-v10 train/val (pinned shas) + questions v10 + excluded kinds + empty suite,
the ens5 teacher (P3-3, sha-checked), pod_pipeline_hx.sh. Writes PACK.sha256 and a deterministic tgz.
  python3 make_train_pack.py --data-v10 DIR --expect-train-sha S --expect-val-sha S --out DIR"""
import argparse, hashlib, json, os, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
P33 = Path("/workspace/p33run/pack")
TEACHER_SHA = "e112a24aa217b143acf84bd94fb39e3ae8fbabeed2615ba84f60f4ceb73bac0c"
CODE = ["train_shared.py", "shared_model.py", "preprocess_shared.py", "infer_raw_shared.py", "common_shared.py",
        "pod_pipeline_hx.sh", "tests/test_head_ext.py", "tests/test_head_init.py",
        "data-v10/laya-questions-v10.json", "data-v10/excluded-kinds.json"]


def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    for a in ("--data-v10", "--expect-train-sha", "--expect-val-sha", "--out"):
        ap.add_argument(a, required=True)
    a = ap.parse_args()
    d = Path(a.data_v10); out = Path(a.out)
    if sha(d / "train.jsonl") != a.expect_train_sha or sha(d / "val.jsonl") != a.expect_val_sha:
        raise SystemExit("data-v10 sha differs from the pin")
    if sha(P33 / "teacher/ens5-train-soft-v9.jsonl") != TEACHER_SHA:
        raise SystemExit("teacher sha differs")
    pins = json.load(open(HERE / "HEADEXT-PINS.json"))["files"]
    for f in CODE:
        k = "pack/" + f
        if k in pins and sha(HERE / k) != pins[k]:
            raise SystemExit(f"pinned file differs: {k}")
    if out.exists():
        shutil.rmtree(out)
    (out / "tests").mkdir(parents=True); (out / "data-v10").mkdir(); (out / "teacher").mkdir()
    for f in CODE:
        shutil.copy2(HERE / "pack" / f, out / f)
    for f in ("average_n.py", "requirements.txt"):
        shutil.copy2(P33 / f, out / f)
    for f in ("train.jsonl", "val.jsonl"):
        shutil.copy2(d / f, out / "data-v10" / f)
    (out / "data-v10" / "empty-suite.json").write_text('{"items": []}\n')
    shutil.copy2(P33 / "teacher/ens5-train-soft-v9.jsonl", out / "teacher/ens5-train-soft-v9.jsonl")
    (out / "teacher/ens5-train-soft-v9.jsonl.sha256").write_text(f"{TEACHER_SHA}  ens5-train-soft-v9.jsonl\n")
    files = sorted(str(p.relative_to(out)) for p in out.rglob("*") if p.is_file())
    (out / "PACK.sha256").write_text("".join(f"{sha(out / f)}  {f}\n" for f in files))
    tgz = out.with_suffix(".tgz")
    subprocess.run(f"cd {out} && tar --sort=name --mtime=2026-11-03 --owner=0 --group=0 --numeric-owner -cf - . | gzip -n > {tgz}",
                   shell=True, check=True)
    print(json.dumps({"n_files": len(files) + 1, "pack_sha256": sha(out / "PACK.sha256"), "tgz": str(tgz), "tgz_sha256": sha(tgz),
                      "train_sha256": a.expect_train_sha, "val_sha256": a.expect_val_sha}))


if __name__ == "__main__":
    sys.exit(main())
