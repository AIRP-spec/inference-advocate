#!/usr/bin/env python3
"""3b RLCD fine-tune of the shared-encoding model. The loss, noise, optimizer, schedule, checkpoint cadence and
NaN hardening are those of train_airp.py (deciding run); only the model and the batch layout differ:
one sequence per response, 17 label vectors per sequence."""
from __future__ import annotations

import argparse
import json
import math
import random
import time
from pathlib import Path

import numpy as np
import torch
from safetensors.torch import save_file
from transformers import AutoTokenizer

from laya.common import proper_reward
from shared_model import KMAX, SharedModel, load_base


def collate(items, pad_id):
    n, L = len(items), max(len(it["ids"]) for it in items)
    ids = torch.full((n, L), pad_id, dtype=torch.long)
    att = torch.zeros((n, L), dtype=torch.long)
    for i, it in enumerate(items):
        ids[i, : len(it["ids"])] = torch.tensor(it["ids"])
        att[i, : len(it["ids"])] = 1
    return ids, att, torch.stack([it["target"] for it in items])


def save_checkpoint(model, tok, out_dir: Path, meta):
    out_dir.mkdir(parents=True, exist_ok=True)
    sd = {k: v.half().contiguous().cpu() for k, v in model.state_dict().items()}
    save_file(sd, str(out_dir / "model.safetensors"))
    model.encoder.config.save_pretrained(str(out_dir / "encoder"))
    tok.save_pretrained(str(out_dir / "tokenizer"))
    json.dump(meta, open(out_dir / "shared_config.json", "w"), indent=2)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--train-items", type=Path, default=Path("preprocessed/train_items.pt"))
    p.add_argument("--preprocess-meta", type=Path, default=Path("preprocessed/preprocess-meta.json"))
    p.add_argument("--output-dir", type=Path, required=True)
    p.add_argument("--epochs", type=float, default=3.0)
    p.add_argument("--batch-size", type=int, default=8)
    p.add_argument("--grad-accum", type=int, default=4)
    p.add_argument("--lr-encoder", type=float, default=2e-5)
    p.add_argument("--lr-head", type=float, default=1e-4)
    p.add_argument("--group-size", type=int, default=4)
    p.add_argument("--sigma-start", type=float, default=0.25)
    p.add_argument("--sigma-end", type=float, default=0.1)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--ckpt-every-epochs", type=float, default=0.5)
    p.add_argument("--log-every", type=int, default=50)
    p.add_argument("--amp", choices=("bf16", "fp16", "off"), default="bf16")
    p.add_argument("--logit-clamp", type=float, default=30.0)
    p.add_argument("--max-consecutive-nan-logs", type=int, default=30)
    p.add_argument("--head-layers", type=int, default=2)
    p.add_argument("--no-grad-checkpointing", action="store_true")
    a = p.parse_args()

    meta = json.load(open(a.preprocess_meta))
    device = torch.device("cuda", 0) if torch.cuda.is_available() else torch.device("cpu")
    torch.manual_seed(a.seed)
    np.random.seed(a.seed)
    random.seed(a.seed)
    model, _cfg = load_base(meta["model_dir"], len(meta["qids"]), head_layers=a.head_layers)
    tok = AutoTokenizer.from_pretrained(str(Path(meta["model_dir"]) / "tokenizer"))
    if not a.no_grad_checkpointing and hasattr(model.encoder, "gradient_checkpointing_enable"):
        model.encoder.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})  # as in train_airp.py
    model.to(device).train()
    shared_cfg = {"n_questions": len(meta["qids"]), "qids": meta["qids"], "qtypes": meta["qtypes"], "widths": meta["widths"],
                  "head_layers": a.head_layers, "max_len": meta["max_len"], "input_format": "[CLS] response [SEP]",
                  "base_model": "convaiinnovations/laya", "base_weight_sha256": meta["weight_sha256"]}

    qtype = torch.tensor(meta["qtypes"], device=device)
    widths = torch.tensor(meta["widths"], device=device)
    qmask = (torch.arange(KMAX, device=device)[None, :] < widths[:, None])  # [Q,K]

    all_items = torch.load(str(a.train_items), weights_only=False)
    MB, GA, G = a.batch_size, a.grad_accum, a.group_size
    n_items = len(all_items)
    steps_per_epoch = int(math.ceil(n_items / float(MB * GA)))
    half_steps = max(1, int(round(steps_per_epoch * a.ckpt_every_epochs)))
    enc_params = [q for n, q in model.named_parameters() if n.startswith("encoder.")]
    head_params = model.head_parameters()
    opt = torch.optim.AdamW([{"params": enc_params, "lr": a.lr_encoder}, {"params": head_params, "lr": a.lr_head}], weight_decay=0.01)
    EPOCHS = float(a.epochs)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, steps_per_epoch * int(math.ceil(EPOCHS))), eta_min=1e-6)
    amp = a.amp
    if amp == "bf16" and device.type == "cuda" and not torch.cuda.is_bf16_supported():
        amp = "fp16"
    amp_dtype = {"bf16": torch.bfloat16, "fp16": torch.float16, "off": None}[amp]
    use_scaler = amp == "fp16" and device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_scaler)
    a.output_dir.mkdir(parents=True, exist_ok=True)
    print(f"SHARED RLCD train | items={n_items} | epochs={EPOCHS} | micro={MB} | accum={GA} | steps/epoch≈{steps_per_epoch} | "
          f"ckpt every {a.ckpt_every_epochs} ep (~{half_steps} steps) | device={device} | AMP={amp}", flush=True)

    t0 = time.time()
    loss_curve, ckpt_records = [], []
    global_step, next_ckpt_at, epoch_f, skipped = 0, half_steps, 0.0, 0
    nan_streak = 0
    my_items = list(all_items)
    for epoch in range(int(math.ceil(EPOCHS))):
        if epoch_f >= EPOCHS - 1e-9:
            break
        random.seed(a.seed + epoch)
        random.shuffle(my_items)
        epoch_loss, n_batches, accum_step = 0.0, 0, 0
        opt.zero_grad(set_to_none=True)
        progress = min(1.0, epoch_f / max(1e-9, EPOCHS - a.ckpt_every_epochs))
        sigma = a.sigma_start + (a.sigma_end - a.sigma_start) * progress
        for b_idx in range(0, len(my_items), MB):
            if epoch_f >= EPOCHS - 1e-9:
                break
            chunk = my_items[b_idx: b_idx + MB]
            if not chunk:
                continue
            ids, att, tgt3 = collate(chunk, tok.pad_token_id)
            with torch.autocast("cuda", dtype=amp_dtype if amp_dtype is not None else torch.float32,
                                enabled=(device.type == "cuda" and amp != "off")):
                out = model(ids.to(device), att.to(device))  # [n,Q,K]
            n = out.size(0)
            logits = out.float().reshape(n * len(meta["qids"]), KMAX).clamp(-a.logit_clamp, a.logit_clamp)
            mask = qmask.unsqueeze(0).expand(n, -1, -1).reshape(-1, KMAX)
            qt = qtype.unsqueeze(0).expand(n, -1).reshape(-1)
            target = tgt3.to(device).reshape(-1, KMAX)
            k = mask.sum(-1, keepdim=True).float().clamp_min(1.0)
            eps = torch.randn((G,) + logits.shape, device=device) * sigma * mask
            eps = (eps - eps.sum(-1, keepdim=True) / k) * mask
            z = logits.detach().unsqueeze(0) + eps
            q = torch.softmax(z.masked_fill(~mask, -1e4), -1)
            with torch.no_grad():
                r = proper_reward(q, target.unsqueeze(0), qt, mask, w_sph=0.75, w_rps=1.0)
                adv = r - r.mean(0, keepdim=True)
                adv = adv / (adv.std() + 1e-6)
            logp = -(((z - logits.unsqueeze(0)) ** 2) * mask).sum(-1) / (2 * sigma ** 2)
            loss_rl = -(adv * logp).mean()
            loss_ce = -(target * torch.log_softmax(logits.masked_fill(~mask, -1e4), -1)).sum(-1).mean()
            loss = (loss_rl + 1.0 * loss_ce) / GA
            if not torch.isfinite(loss):
                skipped += 1
                if skipped % 20 == 1:
                    print(f"  skip nonfinite loss (count={skipped}) at opt_step≈{global_step}", flush=True)
                continue
            (scaler.scale(loss) if use_scaler else loss).backward()
            accum_step += 1
            did_step = False
            if accum_step % GA == 0 or (b_idx + MB) >= len(my_items):
                if use_scaler:
                    scaler.unscale_(opt)
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                if use_scaler:
                    scaler.step(opt)
                    scaler.update()
                else:
                    opt.step()
                sched.step()
                opt.zero_grad(set_to_none=True)
                global_step += 1
                did_step = True
                epoch_f = global_step / float(steps_per_epoch)
                with torch.no_grad():
                    if any(not torch.isfinite(pp).all() for pp in model.parameters()):
                        raise SystemExit(f"FATAL: nonfinite parameters after opt_step {global_step}; aborting")
            loss_val = float(loss.item() * GA)
            epoch_loss += loss_val
            n_batches += 1
            loss_curve.append({"step": global_step, "epoch": round(epoch_f, 4), "loss": loss_val, "reward": float(r.mean().item()), "sigma": sigma})
            if n_batches % a.log_every == 0:
                print(f"  ep≈{epoch_f:.3f}/{EPOCHS} | opt_step {global_step} | Loss {loss_val:.4f} | R {float(r.mean()):.3f} | "
                      f"LR {sched.get_last_lr()[0]:.2e} | σ {sigma:.3f} | skips={skipped}", flush=True)
                if not math.isfinite(loss_val):
                    nan_streak += 1
                    if nan_streak >= a.max_consecutive_nan_logs:
                        raise SystemExit("FATAL: consecutive nonfinite logged losses")
                else:
                    nan_streak = 0
            if did_step and global_step >= next_ckpt_at:
                ep_tag = round(round(epoch_f / a.ckpt_every_epochs) * a.ckpt_every_epochs, 1)
                d = a.output_dir / f"ckpt-epoch-{ep_tag:.1f}-step-{global_step}"
                print(f"=== Saving checkpoint {d.name} ===", flush=True)
                save_checkpoint(model, tok, d, shared_cfg)
                ckpt_records.append({"path": str(d), "epoch": ep_tag, "step": global_step, "loss": loss_val})
                next_ckpt_at += half_steps
        print(f"=== Epoch block {epoch+1} wall={time.time()-t0:.1f}s | avg_loss={epoch_loss/max(1,n_batches):.4f} | ep≈{epoch_f:.3f} ===", flush=True)
    ep_tag = round(min(EPOCHS, epoch_f), 1)
    final = a.output_dir / f"ckpt-epoch-{ep_tag:.1f}-step-{global_step}"
    if not any(rr["path"] == str(final) for rr in ckpt_records):
        print(f"=== Saving final checkpoint {final.name} ===", flush=True)
        save_checkpoint(model, tok, final, shared_cfg)
        ckpt_records.append({"path": str(final), "epoch": ep_tag, "step": global_step, "loss": None})
    losses = [x["loss"] for x in loss_curve]
    tm = {"epochs": EPOCHS, "batch_size": MB, "grad_accum": GA, "steps_per_epoch": steps_per_epoch, "lr_encoder": a.lr_encoder,
          "lr_head": a.lr_head, "group_size": G, "sigma_start": a.sigma_start, "sigma_end": a.sigma_end, "seed": a.seed,
          "wall_time_sec": time.time() - t0, "global_steps": global_step, "skipped_nonfinite": skipped, "n_train_items": n_items,
          "checkpoints": ckpt_records, "loss_first": losses[0] if losses else None, "loss_last": losses[-1] if losses else None,
          "loss_mean": float(np.mean(losses)) if losses else None}
    json.dump(tm, open(a.output_dir / "training-meta.json", "w"), indent=2)
    with open(a.output_dir / "loss_curve.jsonl", "w") as f:
        for row in loss_curve:
            f.write(json.dumps(row) + "\n")
    print(f"Done. wall={tm['wall_time_sec']:.1f}s steps={global_step} ckpts={len(ckpt_records)}", flush=True)


if __name__ == "__main__":
    main()
