#!/usr/bin/env python3
# Gate existing sweep LoRA folders. Does not train.
#
# Paper: step 8. Provisional Section 3.3. Last night's export kept every
# merged 3B and every GGUF at once and filled the disk. This script walks
# data/evaluator-training/artifacts/sweep/lora/checkpoint-*, merges one
# adapter into HuggingFaceTB/SmolLM3-3B, converts Q8_0, runs gate.mjs
# (the real LocalEvaluator v3 path), records the report, then deletes the
# merged weights and the GGUF before the next folder. Scoring is not
# reimplemented. The live pin is not flipped.

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent

sys.path.insert(0, str(HERE))
import train as airp_train  # noqa: E402


def parse_args():
    p = argparse.ArgumentParser(
        description="Merge, GGUF, and gate saved sweep LoRA checkpoints. Does not train."
    )
    p.add_argument("--recipe", default=str(HERE / "sweep-recipe.json"))
    p.add_argument("--lora-dir", default="")
    p.add_argument("--gpu", action="store_true", help="Pass --gpu to gate.mjs")
    return p.parse_args()


def checkpoint_step(path: Path) -> int:
    suffix = path.name.split("-", 1)[1]
    if not suffix.isdigit():
        raise ValueError(f"not a numbered checkpoint folder: {path.name}")
    return int(suffix)


def list_checkpoint_dirs(lora_dir: Path) -> list[Path]:
    found = []
    for p in lora_dir.glob("checkpoint-*"):
        if not p.is_dir():
            continue
        suffix = p.name.split("-", 1)[1]
        if not suffix.isdigit():
            continue
        if not (p / "adapter_config.json").exists():
            print(f"skip {p.name}: no adapter_config.json")
            continue
        found.append(p)
    found.sort(key=checkpoint_step)
    return found


def read_trainer_meta(adapter_dir: Path, step: int):
    state_path = adapter_dir / "trainer_state.json"
    epoch = None
    loss = None
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding="utf-8"))
        epoch = state.get("epoch")
        loss = airp_train.loss_at_or_before(state.get("log_history"), step)
    return epoch, loss


def format_table(rows: list[dict]) -> str:
    headers = [
        "checkpoint",
        "epoch",
        "loss",
        "extra-fires",
        "recall-misses",
        "clean-fires",
        "per-class-pass",
        "gate",
    ]
    body = []
    for r in rows:
        loss = r.get("loss")
        if loss is None:
            loss_s = "unknown"
        else:
            loss_s = f"{loss:.4f}" if float(loss) >= 0.01 else f"{float(loss):.4g}"
        epoch = r.get("epoch")
        epoch_s = "unknown" if epoch is None else str(round(float(epoch), 3))
        body.append(
            [
                r["name"],
                epoch_s,
                loss_s,
                str(r["extraClassFires"]),
                str(r["recallMisses"]),
                str(r["cleanFires"]),
                f"{r['perClassPass']}/{r['perClassTotal']}",
                "PASS" if r["pass"] else "FAIL",
            ]
        )
    widths = [len(h) for h in headers]
    for row in body:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(cell))

    def line(cells):
        return "  ".join(c.ljust(widths[i]) for i, c in enumerate(cells))

    out = [line(headers), line(["-" * w for w in widths])]
    out.extend(line(row) for row in body)
    return "\n".join(out)


def rm_if_exists(path: Path):
    if not path.exists():
        return
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink()
    print(f"deleted {path}")


def gate_one(gguf_path: Path, report_path: Path, gpu: bool) -> int:
    node = shutil.which("node") or "node"
    cmd = [
        node,
        str(HERE / "gate.mjs"),
        "--gguf",
        str(gguf_path),
        "--report",
        str(report_path),
        "--allow-fail",
    ]
    if gpu:
        cmd.append("--gpu")
    print("+", " ".join(cmd), flush=True)
    result = subprocess.run(cmd, cwd=str(REPO))
    return result.returncode


def summarize_report(report: dict) -> dict:
    per_class = report.get("perClass") or []
    return {
        "extraClassFires": report.get("extraClassFires"),
        "recallMisses": len(report.get("recallFailures") or []),
        "cleanFires": len(report.get("cleanFires") or []),
        "perClassPass": sum(1 for c in per_class if c.get("pass")),
        "perClassTotal": len(per_class),
        "pass": report.get("pass") is True,
        "pin": report.get("pin"),
    }


def main():
    args = parse_args()
    recipe = airp_train.load_json(Path(args.recipe))
    if recipe.get("sft") and "held-out" in recipe["sft"]:
        raise SystemExit("recipe training input must not be the held-out suite")
    manifest = airp_train.load_json(airp_train.REPO / recipe["base"]["source"])
    field = recipe["base"]["field"]
    base_id = manifest.get(field)
    if not base_id:
        raise SystemExit(f"manifest has no {field}")
    if base_id != recipe["base"]["repoId"]:
        raise SystemExit(
            f"recipe base.repoId {recipe['base']['repoId']} does not match manifest {field} {base_id}"
        )
    if base_id != "HuggingFaceTB/SmolLM3-3B":
        raise SystemExit(f"gate-from-adapters expects HuggingFaceTB/SmolLM3-3B, got {base_id}")

    out_dir = airp_train.REPO / recipe["outputs"]["dir"]
    lora_dir = Path(args.lora_dir) if args.lora_dir else out_dir / recipe["outputs"]["adapter"]
    if not lora_dir.is_dir():
        raise SystemExit(
            f"no LoRA directory at {lora_dir}. This script does not train. "
            "It gates checkpoint-* folders that already exist."
        )
    checkpoints = list_checkpoint_dirs(lora_dir)
    if not checkpoints:
        raise SystemExit(f"no checkpoint-* adapters with adapter_config.json under {lora_dir}")

    print(f"base {base_id}")
    print(f"lora {lora_dir}")
    print(f"checkpoints {len(checkpoints)}: {', '.join(p.name for p in checkpoints)}")
    print("does not train")

    leftover_f16 = out_dir / "model-f16.gguf"
    rm_if_exists(leftover_f16)
    for p in out_dir.glob("merged-step-*"):
        rm_if_exists(p)
    for p in out_dir.glob("step-*.gguf"):
        rm_if_exists(p)

    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(base_id, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    rows = []
    for adapter_dir in checkpoints:
        step = checkpoint_step(adapter_dir)
        epoch, loss = read_trainer_meta(adapter_dir, step)
        merged_dir = out_dir / f"merged-step-{step}"
        gguf_path = out_dir / f"step-{step}.gguf"
        report_path = out_dir / f"gate-report-step-{step}.json"
        print(f"\n== {adapter_dir.name} step {step} epoch {epoch} loss {loss} ==")
        try:
            rm_if_exists(merged_dir)
            rm_if_exists(gguf_path)
            rm_if_exists(leftover_f16)
            llama_commit, sha = airp_train.export_adapter_gguf(
                recipe,
                base_id,
                tokenizer,
                adapter_dir,
                merged_dir,
                gguf_path,
                out_dir,
            )
            print(f"GGUF sha256 {sha} llama.cpp {llama_commit}")
            rm_if_exists(merged_dir)
            rm_if_exists(leftover_f16)
            status = gate_one(gguf_path, report_path, args.gpu)
            if status not in (0, 2):
                raise SystemExit(f"gate.mjs exited {status} for {adapter_dir.name}")
            if not report_path.exists():
                raise SystemExit(f"gate.mjs wrote no report at {report_path}")
            report = json.loads(report_path.read_text(encoding="utf-8"))
            summary = summarize_report(report)
            row = {
                "name": adapter_dir.name,
                "step": step,
                "epoch": epoch,
                "loss": loss,
                "adapterDir": str(adapter_dir),
                "gateReport": str(report_path),
                "ggufSha256": sha,
                **summary,
            }
            rows.append(row)
            print(
                f"{adapter_dir.name}: extra={row['extraClassFires']} "
                f"recall-misses={row['recallMisses']} clean={row['cleanFires']} "
                f"per-class-pass={row['perClassPass']}/{row['perClassTotal']} "
                f"{'PASS' if row['pass'] else 'FAIL'}"
            )
        finally:
            rm_if_exists(merged_dir)
            rm_if_exists(gguf_path)
            rm_if_exists(leftover_f16)

    table = format_table(rows)
    print("\n" + table)
    payload = {
        "paper": recipe["paper"],
        "adr": "Gate-only from saved adapters. Does not train. Merged weights and GGUF deleted after each checkpoint.",
        "baseRepoId": base_id,
        "loraDir": str(lora_dir),
        "n": len(rows),
        "checkpoints": rows,
        "table": table,
    }
    table_json = out_dir / "adapter-gate-table.json"
    table_txt = out_dir / "adapter-gate-table.txt"
    out_dir.mkdir(parents=True, exist_ok=True)
    table_json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    table_txt.write_text(table + "\n", encoding="utf-8")
    print(f"wrote {table_json}")
    print(f"wrote {table_txt}")
    print("done. did not train.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
