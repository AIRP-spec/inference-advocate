#!/usr/bin/env python3
# LoRA SFT of the pinned evaluator base, then merge, then GGUF Q8_0.
#
# Paper: step 8. Provisional Section 3.3. The commons reference evaluation
# model is a trained artifact. Labels already sit on the SFT assistant line
# (the v3 compact verdict). This script does not read the held-out suite.
# Training base repo id comes from data/models/manifest.json trainBaseRepoId.
# The live pin (baseRepoId / fileName) is not read here and is not changed.
# When the recipe has a sweep block, interval checkpoints are kept and each
# is merged and converted so the gate can score the whole training curve.

from __future__ import annotations

import argparse
import hashlib
import inspect
import json
import math
import random
import subprocess
import sys
import time
from pathlib import Path


HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
MIN_TRANSFORMERS = (4, 53, 0)
SAMPLE_MESSAGES = [
    {"role": "system", "content": "AIRP evaluator sample system."},
    {"role": "user", "content": "hello"},
    {"role": "assistant", "content": "no yes no"},
]


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def run(cmd, cwd=None):
    print("+", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def parse_args():
    p = argparse.ArgumentParser(description="Train the AIRP reference evaluator LoRA")
    p.add_argument("--recipe", default=str(HERE / "train-recipe.json"))
    p.add_argument("--skip-gguf", action="store_true")
    p.add_argument("--skip-export-checkpoints", action="store_true")
    p.add_argument("--out", default="")
    p.add_argument(
        "--check-template",
        action="store_true",
        help="Load the tokenizer, verify render equality, a non-empty assistant mask, verdict-in-mask, and no-think, then exit.",
    )
    return p.parse_args()


def parse_version(v: str):
    core = v.split("+")[0].split(".dev")[0]
    nums = []
    for part in core.split("."):
        digits = ""
        for ch in part:
            if ch.isdigit():
                digits += ch
            else:
                break
        nums.append(int(digits or 0))
    while len(nums) < 3:
        nums.append(0)
    return tuple(nums[:3])


def assert_transformers_supports_base(base_id: str, recipe) -> str:
    import transformers

    ver = transformers.__version__
    pinned = recipe["framework"]["pins"]["transformers"]
    print(f"transformers {ver} (recipe pin {pinned}; SmolLM3 modeling needs >= 4.53.0)")
    if "SmolLM3" in base_id and parse_version(ver) < MIN_TRANSFORMERS:
        raise SystemExit(
            f"transformers {ver} cannot load SmolLM3 (needs >= 4.53.0). "
            f"Upgrade to the recipe pin {pinned} before training."
        )
    return ver


def set_seeds(seed: int):
    random.seed(seed)
    try:
        import numpy as np

        np.random.seed(seed)
    except ImportError:
        pass
    import torch

    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def wrap_tokenizer_enable_thinking(tokenizer, enable_thinking: bool):
    # SmolLM3 defaults enable_thinking to true. TRL's apply_chat_template
    # calls do not pass the kwarg, so without this wrap the metadata line
    # becomes Reasoning Mode: /think and the target is no longer the compact
    # verdict. The wrap is how no-think stays on for every call, including
    # the trainer's. It is not Qwen's empty-think-block trick.
    original = tokenizer.apply_chat_template

    def apply_chat_template(*args, **kwargs):
        kwargs.setdefault("enable_thinking", enable_thinking)
        return original(*args, **kwargs)

    tokenizer.apply_chat_template = apply_chat_template
    return tokenizer


def flatten_mask(encoded):
    mask = encoded.get("assistant_masks")
    if mask is None:
        mask = encoded.get("assistant_mask")
    if mask is None:
        return None
    if len(mask) > 0 and isinstance(mask[0], (list, tuple)):
        return list(mask[0])
    return list(mask)


def flatten_ids(encoded):
    ids = encoded["input_ids"]
    if len(ids) > 0 and isinstance(ids[0], (list, tuple)):
        return list(ids[0])
    return list(ids)


def assert_generation_aware_template(tokenizer, stock_template, messages, enable_thinking: bool):
    """Fail before any GPU work if the mask is empty, think is on, or render drifted from stock."""
    current = tokenizer.chat_template
    tokenizer.chat_template = stock_template
    stock_text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
        enable_thinking=enable_thinking,
    )
    tokenizer.chat_template = current
    ours_text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
        enable_thinking=enable_thinking,
    )
    if stock_text != ours_text:
        raise SystemExit(
            "generation-aware chat template does not render identically to the stock template. "
            f"stock_len={len(stock_text)} ours_len={len(ours_text)}. "
            "Update the recipe chatTemplate; do not train."
        )
    if not enable_thinking:
        if "Reasoning Mode: /no_think" not in ours_text:
            raise SystemExit(
                "no-think is not active: rendered text is missing 'Reasoning Mode: /no_think'. "
                "SmolLM3 no-think is that metadata line, not a Qwen empty-think wrapper. Do not train."
            )
        if "Reasoning Mode: /think" in ours_text:
            raise SystemExit(
                "no-think is not active: rendered text still has 'Reasoning Mode: /think'. Do not train."
            )
    encoded = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=False,
        enable_thinking=enable_thinking,
        return_assistant_tokens_mask=True,
        return_dict=True,
    )
    mask = flatten_mask(encoded)
    if mask is None:
        raise SystemExit(
            "tokenizer did not return an assistant mask. The chat template is missing {% generation %} "
            "or this transformers version cannot build the mask. Refusing to train with full-sequence loss."
        )
    n = sum(int(x) for x in mask)
    if n == 0:
        raise SystemExit(
            "assistant token mask is empty. assistant_only_loss would crash or train nothing. "
            "The {% generation %} span is not covering the verdict. Do not train."
        )
    ids = flatten_ids(encoded)
    asst_ids = [tid for tid, m in zip(ids, mask) if int(m)]
    decoded = tokenizer.decode(asst_ids)
    verdict = messages[-1]["content"]
    if verdict not in decoded:
        raise SystemExit(
            "assistant mask does not cover the compact verdict line "
            f"(decoded mask {decoded!r}). Do not train."
        )
    if not enable_thinking and "<think>" in decoded:
        raise SystemExit(
            "assistant mask includes think tags. Those are the no-think prefix, not the verdict. "
            "Move {% generation %} so the empty think block sits outside the mask. Do not train."
        )
    print(
        f"chat template ok: render matches stock, assistant mask {n} tokens, "
        f"verdict inside mask, no-think {'active' if not enable_thinking else 'off (thinking enabled)'}"
    )
    return n


def install_generation_aware_template(tokenizer, template_path: Path):
    stock = tokenizer.chat_template
    if not template_path.exists():
        raise SystemExit(f"missing {template_path}")
    ours = template_path.read_text(encoding="utf-8")
    if "{% generation" not in ours and "{%- generation" not in ours:
        raise SystemExit(f"{template_path} has no {{% generation %}} span")
    tokenizer.chat_template = ours
    return stock


def load_sft_rows(sft_path: Path, first_only: bool):
    rows = []
    with sft_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            messages = rec.get("messages")
            if not isinstance(messages, list) or len(messages) != 3:
                raise SystemExit(f"SFT row {rec.get('id')} is not three chat turns")
            roles = [m.get("role") for m in messages]
            if roles != ["system", "user", "assistant"]:
                raise SystemExit(f"SFT row {rec.get('id')} roles {roles} are not system/user/assistant")
            rows.append({"messages": messages})
            if first_only:
                break
    if len(rows) == 0:
        raise SystemExit("SFT file is empty")
    return rows


def steps_per_epoch(n: int, recipe) -> int:
    eff = recipe["train"]["effectiveBatchSize"]
    if not eff:
        raise SystemExit("train.effectiveBatchSize must be a positive integer")
    return math.ceil(n / eff)


def sweep_save_steps(n: int, recipe) -> int:
    every = recipe["sweep"]["saveEveryEpoch"]
    spe = steps_per_epoch(n, recipe)
    return max(1, round(spe * every)), spe


def loss_at_or_before(log_history, step):
    last = None
    for row in log_history or []:
        if "loss" not in row:
            continue
        if int(row.get("step") or 0) <= step:
            last = row["loss"]
    return last


def collect_checkpoint_rows(adapter_dir: Path, log_history, spe: int, final_step: int, final_dir: Path):
    rows = []
    seen = set()
    paths = sorted(
        adapter_dir.glob("checkpoint-*"),
        key=lambda p: int(p.name.split("-")[1]) if p.name.split("-")[1].isdigit() else 10**12,
    )
    for p in paths:
        suffix = p.name.split("-", 1)[1]
        if not suffix.isdigit():
            continue
        step = int(suffix)
        if not (p / "adapter_config.json").exists():
            continue
        seen.add(step)
        rows.append(
            {
                "step": step,
                "epoch": round(step / spe, 3),
                "loss": loss_at_or_before(log_history, step),
                "adapterDir": str(p),
            }
        )
    if final_step and final_step not in seen and (final_dir / "adapter_config.json").exists():
        rows.append(
            {
                "step": final_step,
                "epoch": round(final_step / spe, 3),
                "loss": loss_at_or_before(log_history, final_step),
                "adapterDir": str(final_dir),
            }
        )
    rows.sort(key=lambda r: r["step"])
    return rows


def sft_config_kwargs(recipe, adapter_dir: Path, seed: int, n_examples: int) -> dict:
    t = recipe["train"]
    kwargs = dict(
        output_dir=str(adapter_dir),
        num_train_epochs=t["epochs"],
        per_device_train_batch_size=t["perDeviceBatchSize"],
        gradient_accumulation_steps=t["gradientAccumulationSteps"],
        learning_rate=t["learningRate"],
        lr_scheduler_type=t["lrScheduler"],
        warmup_ratio=t["warmupRatio"],
        logging_steps=10,
        save_strategy="epoch",
        save_total_limit=1,
        bf16=t["bf16"],
        seed=seed,
        data_seed=seed,
        report_to=recipe["framework"]["reportTo"],
        remove_unused_columns=False,
    )
    from trl import SFTConfig

    params = inspect.signature(SFTConfig.__init__).parameters
    if "packing" in params:
        kwargs["packing"] = t["packing"]
    if "max_length" in params:
        kwargs["max_length"] = t["maxSeqLen"]
    elif "max_seq_length" in params:
        kwargs["max_seq_length"] = t["maxSeqLen"]
    if t.get("assistantOnlyLoss"):
        if "assistant_only_loss" in params:
            kwargs["assistant_only_loss"] = True
        elif "completion_only_loss" in params:
            kwargs["completion_only_loss"] = True
        else:
            raise SystemExit(
                "TRL SFTConfig has neither assistant_only_loss nor completion_only_loss. "
                "Refusing to train with full-sequence loss."
            )
    if recipe.get("sweep"):
        save_steps, spe = sweep_save_steps(n_examples, recipe)
        kwargs["save_strategy"] = "steps"
        kwargs["save_steps"] = save_steps
        kwargs.pop("save_total_limit", None)
        kwargs["logging_steps"] = 1
        print(
            f"sweep checkpointing every {save_steps} steps "
            f"({recipe['sweep']['saveEveryEpoch']} epoch, {spe} steps/epoch, n={n_examples})"
        )
    return kwargs


def convert_gguf(recipe, merged_dir: Path, gguf_path: Path, work: Path) -> str:
    spec = recipe["gguf"]["llamaCpp"]
    llama_dir = work / "llama.cpp"
    if not llama_dir.exists():
        cloned = False
        last_err = None
        for repo in (spec["repo"], spec.get("fallbackRepo")):
            if not repo:
                continue
            cmd = ["git", "clone", "--depth", "1", repo, str(llama_dir)]
            ref = spec.get("ref") or "HEAD"
            if ref != "HEAD":
                cmd = ["git", "clone", "--depth", "1", "--branch", ref, repo, str(llama_dir)]
            try:
                run(cmd)
                cloned = True
                break
            except subprocess.CalledProcessError as err:
                last_err = err
                if llama_dir.exists():
                    import shutil

                    shutil.rmtree(llama_dir)
        if not cloned:
            raise SystemExit(
                f"git clone of llama.cpp failed ({last_err}). Install git, or set llamaCpp.ref to a tag this host can fetch."
            )
    commit = subprocess.check_output(
        ["git", "-C", str(llama_dir), "rev-parse", "HEAD"], text=True
    ).strip()
    convert_py = llama_dir / "convert_hf_to_gguf.py"
    if not convert_py.exists():
        raise SystemExit(f"llama.cpp at {commit} has no convert_hf_to_gguf.py")
    f16_path = work / "model-f16.gguf"
    run(
        [
            sys.executable,
            str(convert_py),
            str(merged_dir),
            "--outfile",
            str(f16_path),
            "--outtype",
            recipe["gguf"]["outtype"],
        ]
    )
    build_dir = llama_dir / "build"
    quantize = build_dir / "bin" / "llama-quantize"
    if not quantize.exists():
        if subprocess.run(["which", "cmake"], capture_output=True).returncode != 0:
            raise SystemExit(
                "cmake is required to build llama-quantize. On Debian/Ubuntu: apt-get install -y build-essential cmake"
            )
        run(["cmake", "-B", str(build_dir), "-S", str(llama_dir), "-DGGML_CUDA=OFF"])
        run(["cmake", "--build", str(build_dir), "--target", "llama-quantize", "-j", "4"])
    if not quantize.exists():
        raise SystemExit(f"llama-quantize missing after cmake build at {build_dir}")
    gguf_path.parent.mkdir(parents=True, exist_ok=True)
    run([str(quantize), str(f16_path), str(gguf_path), recipe["gguf"]["quantization"]])
    return commit


def export_adapter_gguf(recipe, base_id, tokenizer, adapter_dir: Path, merged_dir: Path, gguf_path: Path, work: Path):
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM

    print(f"exporting adapter {adapter_dir} -> {gguf_path}")
    base = AutoModelForCausalLM.from_pretrained(
        base_id,
        torch_dtype=torch.bfloat16 if recipe["train"]["bf16"] else torch.float32,
        device_map="auto",
        trust_remote_code=True,
    )
    merged = PeftModel.from_pretrained(base, str(adapter_dir))
    merged = merged.merge_and_unload()
    merged_dir.mkdir(parents=True, exist_ok=True)
    merged.save_pretrained(str(merged_dir))
    tokenizer.save_pretrained(str(merged_dir))
    del merged
    del base
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    llama_commit = convert_gguf(recipe, merged_dir, gguf_path, work)
    return llama_commit, sha256_file(gguf_path)


def main():
    args = parse_args()
    recipe = load_json(Path(args.recipe))
    manifest = load_json(REPO / recipe["base"]["source"])
    field = recipe["base"]["field"]
    base_id = manifest.get(field)
    if not base_id:
        raise SystemExit(f"manifest {recipe['base']['source']} has no {field}")
    if base_id != recipe["base"]["repoId"]:
        raise SystemExit(
            f"recipe base.repoId {recipe['base']['repoId']} does not match manifest {field} {base_id}"
        )
    if "held-out" in recipe["sft"]:
        raise SystemExit("training input must not be the held-out suite")
    if "SmolLM3" in base_id and "smollm3" not in recipe["train"]["chatTemplate"].lower():
        raise SystemExit(
            f"SmolLM3 base requires a SmolLM3 chat template, not {recipe['train']['chatTemplate']}"
        )
    tf_ver = assert_transformers_supports_base(base_id, recipe)

    sft_path = REPO / recipe["sft"]
    template_path = REPO / recipe["train"]["chatTemplate"]
    if args.check_template:
        if sft_path.exists():
            rows = load_sft_rows(sft_path, first_only=True)
            print(f"template check sample: first row of {sft_path}")
        else:
            rows = [{"messages": SAMPLE_MESSAGES}]
            print("template check sample: built-in three-turn example (no SFT file)")
    else:
        if not sft_path.exists():
            raise SystemExit(f"no SFT file at {sft_path}. Generate the corpus first.")
        rows = load_sft_rows(sft_path, first_only=False)
        print(f"loaded {len(rows)} SFT rows")

    out_dir = Path(args.out) if args.out else REPO / recipe["outputs"]["dir"]
    if not args.check_template:
        out_dir.mkdir(parents=True, exist_ok=True)
    adapter_dir = out_dir / recipe["outputs"]["adapter"]
    merged_dir = out_dir / recipe["outputs"]["merged"]
    gguf_path = out_dir / recipe["outputs"]["gguf"]
    seed = recipe["seed"]

    print(f"base {base_id} from {recipe['base']['source']} field {field}")
    print(f"sft {sft_path}")
    print(f"seed {seed}")
    if not args.check_template:
        print(recipe["time"]["estimate"])

    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(base_id, trust_remote_code=True)
    stock_template = install_generation_aware_template(tokenizer, template_path)
    tokenizer = wrap_tokenizer_enable_thinking(tokenizer, recipe["train"]["enableThinking"])
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    mask_n = assert_generation_aware_template(
        tokenizer,
        stock_template,
        rows[0]["messages"],
        recipe["train"]["enableThinking"],
    )
    if args.check_template:
        print(f"base {base_id}")
        print(f"transformers {tf_ver} (pin {recipe['framework']['pins']['transformers']})")
        print(f"chatTemplate {recipe['train']['chatTemplate']}")
        print(f"assistant mask tokens {mask_n}")
        print("template check only; not training")
        return

    import torch
    from datasets import Dataset
    from peft import LoraConfig, PeftModel
    from transformers import AutoModelForCausalLM
    from trl import SFTConfig, SFTTrainer

    if not torch.cuda.is_available():
        print("warning: CUDA is not visible. This will be slow on CPU. Continuing because the script is the run.")
    set_seeds(seed)

    model = AutoModelForCausalLM.from_pretrained(
        base_id,
        torch_dtype=torch.bfloat16 if recipe["train"]["bf16"] else torch.float32,
        device_map="auto",
        trust_remote_code=True,
    )
    lora = recipe["lora"]
    peft_config = LoraConfig(
        r=lora["r"],
        lora_alpha=lora["alpha"],
        lora_dropout=lora["dropout"],
        bias=lora["bias"],
        task_type=lora["taskType"],
        target_modules=list(lora["targetModules"]),
    )
    dataset = Dataset.from_list(rows)
    trainer_kwargs = dict(
        model=model,
        args=SFTConfig(**sft_config_kwargs(recipe, adapter_dir, seed, len(rows))),
        train_dataset=dataset,
        peft_config=peft_config,
    )
    trainer_params = inspect.signature(SFTTrainer.__init__).parameters
    if "processing_class" in trainer_params:
        trainer_kwargs["processing_class"] = tokenizer
    else:
        trainer_kwargs["tokenizer"] = tokenizer
    trainer = SFTTrainer(**trainer_kwargs)

    started = time.time()
    trainer.train()
    train_seconds = round(time.time() - started, 1)
    trainer.save_model(str(adapter_dir))
    tokenizer.save_pretrained(str(adapter_dir))
    print(f"saved LoRA adapter to {adapter_dir} after {train_seconds}s")

    log_history = list(trainer.state.log_history)
    final_step = int(trainer.state.global_step)
    sweep = recipe.get("sweep")
    checkpoint_rows = []
    if sweep:
        spe = steps_per_epoch(len(rows), recipe)
        checkpoint_rows = collect_checkpoint_rows(
            adapter_dir, log_history, spe, final_step, adapter_dir
        )
        min_ck = int(sweep.get("minCheckpoints") or 0)
        if len(checkpoint_rows) < min_ck:
            raise SystemExit(
                f"sweep produced {len(checkpoint_rows)} checkpoints, need at least {min_ck}"
            )
        print(f"sweep collected {len(checkpoint_rows)} checkpoints")
        for row in checkpoint_rows:
            print(
                f"  step {row['step']} epoch {row['epoch']} loss {row['loss']} {row['adapterDir']}"
            )

    del trainer
    del model
    import gc

    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    llama_commit = None
    gguf_sha = None
    if sweep:
        if (
            not args.skip_export_checkpoints
            and sweep.get("exportGguf")
            and not args.skip_gguf
        ):
            import shutil

            for row in checkpoint_rows:
                step = row["step"]
                adapter = Path(row["adapterDir"])
                if not (adapter / "adapter_config.json").exists():
                    raise SystemExit(f"checkpoint {adapter} has no adapter_config.json")
                merged_step = out_dir / f"merged-step-{step}"
                gguf_step = out_dir / f"step-{step}.gguf"
                llama_commit, sha = export_adapter_gguf(
                    recipe,
                    base_id,
                    tokenizer,
                    Path(row["adapterDir"]),
                    merged_step,
                    gguf_step,
                    out_dir,
                )
                row["ggufPath"] = str(gguf_step)
                row["ggufSha256"] = sha
                row["llamaCppCommit"] = llama_commit
                shutil.rmtree(merged_step, ignore_errors=True)
                print(f"GGUF {gguf_step} sha256 {sha} llama.cpp {llama_commit}")
        ckpt_name = recipe["outputs"].get("checkpoints") or "checkpoints.json"
        save_steps, spe = sweep_save_steps(len(rows), recipe)
        payload = {
            "paper": recipe["paper"],
            "adr": recipe.get("adr"),
            "seed": seed,
            "baseRepoId": base_id,
            "promptTemplateVersion": recipe["promptTemplateVersion"],
            "sft": str(sft_path.relative_to(REPO)),
            "n": len(rows),
            "trainSeconds": train_seconds,
            "stepsPerEpoch": spe,
            "saveEveryEpoch": sweep["saveEveryEpoch"],
            "saveSteps": save_steps,
            "finalStep": final_step,
            "logHistory": log_history,
            "checkpoints": checkpoint_rows,
        }
        (out_dir / ckpt_name).write_text(
            json.dumps(payload, indent=2) + "\n", encoding="utf-8"
        )
        print(f"wrote {out_dir / ckpt_name}")
        last = checkpoint_rows[-1] if checkpoint_rows else {}
        if last.get("ggufPath"):
            gguf_path = Path(last["ggufPath"])
            gguf_sha = last.get("ggufSha256")
            llama_commit = last.get("llamaCppCommit")
    elif args.skip_gguf:
        print("skipping GGUF conversion (--skip-gguf)")
    else:
        print("merging LoRA into the base")
        merged = PeftModel.from_pretrained(
            AutoModelForCausalLM.from_pretrained(
                base_id,
                torch_dtype=torch.bfloat16 if recipe["train"]["bf16"] else torch.float32,
                device_map="auto",
                trust_remote_code=True,
            ),
            str(adapter_dir),
        )
        merged = merged.merge_and_unload()
        merged_dir.mkdir(parents=True, exist_ok=True)
        merged.save_pretrained(str(merged_dir))
        tokenizer.save_pretrained(str(merged_dir))
        print(f"saved merged model to {merged_dir}")
        del merged
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        llama_commit = convert_gguf(recipe, merged_dir, gguf_path, out_dir)
        gguf_sha = sha256_file(gguf_path)
        print(f"GGUF {gguf_path} sha256 {gguf_sha} llama.cpp {llama_commit}")

    artifacts = {
        "paper": recipe["paper"],
        "seed": seed,
        "baseRepoId": base_id,
        "promptTemplateVersion": recipe["promptTemplateVersion"],
        "sft": str(sft_path.relative_to(REPO)),
        "n": len(rows),
        "trainSeconds": train_seconds,
        "adapterDir": str(adapter_dir),
        "mergedDir": str(merged_dir) if merged_dir.exists() else None,
        "ggufPath": str(gguf_path) if gguf_path.exists() else None,
        "ggufSha256": gguf_sha,
        "ggufFileName": recipe["gguf"]["fileName"],
        "quantization": recipe["gguf"]["quantization"],
        "llamaCppCommit": llama_commit,
        "lora": lora,
        "train": recipe["train"],
        "sweep": sweep,
        "frameworkPins": recipe["framework"]["pins"],
        "pinString": None,
    }
    if gguf_sha:
        artifacts["pinString"] = f"local-llm@{gguf_sha[:12]}+{recipe['promptTemplateVersion']}"
    (out_dir / recipe["outputs"]["manifest"]).write_text(
        json.dumps(artifacts, indent=2) + "\n", encoding="utf-8"
    )
    log = {
        "trainSeconds": train_seconds,
        "n": len(rows),
        "seed": seed,
        "baseRepoId": base_id,
        "finalStep": final_step,
        "logHistory": log_history,
    }
    (out_dir / recipe["outputs"]["trainLog"]).write_text(
        json.dumps(log, indent=2) + "\n", encoding="utf-8"
    )
    print(f"wrote {out_dir / recipe['outputs']['manifest']}")
    if sweep:
        print("sweep next: node tools/evaluator-training/sweep-gate.mjs")
    elif artifacts["pinString"]:
        print(f"candidate pin {artifacts['pinString']}")
        print("gate next: node tools/evaluator-training/gate.mjs")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
