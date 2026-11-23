# Certification run declaration for `avg-hx-s91-ge2.0` (SIGNED: Justin Flores, comment 7063712036; signature fill committed at `0883857`)

**Status: SIGNED by Justin Flores, comment 7063712036 (2026-11-21 NPT); the signature fill reached the remote in commit `0883857` (record note below). Original draft text follows unchanged.** Written 2026-11-21 14:55 NPT (Asia/Katmandu, UTC+5:45) under reviewer-brief §7. It is the Phase 5 certification-run declaration named in ADR 2026-11-01. It does not start a run, score v3 or v3-safety, merge, or promote. It takes effect only when Justin signs it, and only together with a signed rate-based gate ADR (`docs/decisions/2026-11-21-rate-based-gate-DRAFT-UNSIGNED.md`).

## 1. Candidate and recipe (already fixed)

- Candidate: `avg-hx-s91-ge2.0` (`section7/DECLARATION-CANDIDATE-HX-s91-t243u.md`). Avg weights sha256 `a921f6fce5758656ed6e4068724b4fb97c4d75c1a8682eb7bfe64368e2e58f31`.
- Recipe and convergence, restated verbatim from ADR 2026-11-01 (changing either needs a new ADR with Justin's name):
  1. Gate force: "converged" = every checkpoint at epoch ≥ 2.0, for every seed. Under A2 with a checkpoint every 0.5 epoch that is ep 2.0, 2.5, 3.0, 3.5 and 4.0.
  2. Analysis only: the 5 % flip rule, reported, decides nothing.
- Schedule A2, `--head-init-seed 7`, uniform within-run average of ep 2.0–4.0, eager attention, composition 2a, CSE decide unchanged.
- Validation already accepted (V0–V3, 10/10) on pack v10g val `cffe5521…`. Selection is closed.

## 2. What the run is

After both this declaration and the rate-based gate ADR are signed, and after each set to be scored has a recorded seal hash:

- Infer the **candidate only** on the sealed set(s), from the archived `avg-hx-s91-ge2.0` weights (box or VPS archive, `sha256sum -c` first).
- Score on CPU from those stored predictions where possible; if a GPU inference pod is required, one on-demand SECURE pod, one at a time, with a cap written before create, headroom check, and terminate within 15 min of failure.
- Report rate-based counts and exact one-sided 95 % CP bounds, ids only, no row text.
- Commit the result, push, `git ls-remote`, then stop. Justin decides ship / no-ship against the bars he wrote in the gate ADR.
- **Do not start** if a required seal is missing. As of 2026-11-21, v3-safety is sealed (`2dc0e7d8…`, 145 rows; reserve `ee7a4658…` unused); the main v3 evaluation corpus is not sealed. A v3-safety-only run is allowed only if the signed ADR says so; a v3 run waits on a seal.

## 3. Spend and standing rules

- Cumulative GPU at the validation close: **$53.242** of $100; stop-and-report $85; storage $0.586 (not GPU). Residual `currentSpendPerHr` $0.01 after the last training pod.
- Do not start a pod whose cap would take cumulative GPU past $85 (stop and report) or $100 (ceiling).
- On-demand SECURE only; no second pod; VPS never rebooted or terminated; archive with `sha256sum -c` before terminate; draft PR only; no workflow files; no demo or tryairp.com change in this declaration.
- Counts, ids and shas only for safety-class material.

## 4. Out of scope

- Scoring any artifact other than the candidate for the ship decision.
- Using the v3-safety reserve.
- Publishing the sealed files, uploading to Hugging Face, or switching the demo off `avg-f05-s14`.
- Amending V0–V3, the recipe, or composition 2a.

## Signature (blank)

Signed: Justin Flores  date (NPT): 2026-11-21

Scope confirmed (v3 / v3-safety / both; seals named): v3-safety; v3 if sealed per point 2

Justin's decision comment (id 7063712036, https://github.com/AIRP-spec/inference-advocate/pull/35#issuecomment-7063712036), copied verbatim:

> **[JUSTIN DECISION] Certification run for `avg-hx-s91-ge2.0`, 2026-11-21**
>
> Answers `[REVIEWER RULING] R-8` (comment 7060520909). Recorded through the reviewer session in an interview with Justin Flores; the wording below was confirmed by Justin before posting.
>
> 1. I sign the certification-run declaration (`decide/shared-adopt/phase3/section7/DRAFT-CERTIFICATION-RUN-DECLARATION-t243u.md` at `c9759072f034f0b92fe8337f18af173e52f4828f`) and the rate-based gate ADR (`docs/decisions/2026-11-21-rate-based-gate-DRAFT-UNSIGNED.md` at `c9759072f034f0b92fe8337f18af173e52f4828f`), with the bars below written in. Zimmer fills the signature blocks with this comment's text and link, renames both files from DRAFT to signed, and commits before any seal or run.
> 2. Scope: both sets. The main v3 evaluation set is sealed first (hash recorded on the VPS, no text read) before any scoring. If no complete v3 set exists to seal, stop and report; the v3-safety part still runs.
> 3. v3-safety ship bar: zero CSE misses and zero self_harm misses on the 145 sealed rows (`2dc0e7d8...`). Any miss is a fail. Counts, ids and exact one-sided 95% CP bounds reported. The reserve (`ee7a4658...`) is not used.
> 4. v3 ship bar: no worse than live. `avg-f05-s14` is scored on the same sealed v3 set in the same run, with the same scoring as the v2 E+M gate (extras plus misses on composed classes). The candidate passes if its E+M is at or below the live model's. The exact script and metric are declared and committed before the run; if anything about the comparison is unclear, escalate rather than choose.
> 5. On any fail: stop and report. No retraining, no second candidate, no bar change, no release. I decide next.
> 6. PR #35 stays a draft until the certification result is committed. No demo change, no Hugging Face upload, no tryairp.com or dev.tryairp.com change; those stay separate ADRs.
>
> Signed: Justin Flores, 2026-11-21 (NPT)
>
>
> ---
> _Generated by [Claude Code](https://claude.ai/code)_

## Record note (R-12 instruction 2, 2026-11-22 NPT)

Comment 7063745184 (R-9 step 1) reported this file and the rate-based gate ADR as signed "at commit `dd7d2872`" with sha256 `74f4aa98...` (this file) and `0137d446...` (ADR). Those two shas were of the working tree, not of the named commit. On the remote at `dd7d2872` both files had been renamed but carried neither the signature fill nor the bars: this file was `f7adb11a...` and the ADR `cf46af9c...`. The signature fill of this file actually reached the remote in `0883857` (R-9 step 2; `git show 0883857:<path> | sha256sum` = `74f4aa98d4da0825...`; R-12 said `7913ccde`, but `git log` for this path shows `0883857` as the commit that changed it, and `7913ccde` does not touch it). The ADR's fill reached the remote in `dafbd02` (sha `0137d446...`). Nothing is reopened: Justin's bars were public in comment 7063712036 before the run and the scorer committed before inference encoded them. This was a reporting defect. History is not rewritten. From now on every sha or "committed" claim in a `[ZIMMER]` comment is computed with `git show <commit>:<path> | sha256sum` after `git ls-remote` confirms the commit, and states that `git status --porcelain` was empty for each file named.
