# Report: distillation of ens5 (DECLARATION-DISTILL `51e4cc03…` + teacher addendum `7a428e8d…`)

The declaration was committed as `f8e4558` at 10:52:50Z on Oct 14, pushed with an ls-remote match, and VPS sha -c OK. The teacher addendum (`2049bdb`, 12:02:01Z, VPS sha -c OK 12:02:17Z) went in before pod `hc0ltnx3rwnvq0` was created at 12:02:30Z.

## Outcome: **FAIL**. No fallback. STOP.

The decision-bearing mode is temperature and thresholds **fitted on validation** (`fit_secondary.py`). Epoch 3.0 was fixed in advance. Composition: corrected `4e840f3b…`.

| seed | T_stance / T_noul | val composed F1 | v2 E/M (E+M) | CSE | self_harm misses | verdict |
|---|---|---:|---|---|---:|---|
| s9 | 3.40 / 4.02 | 0.8586 | 16/33 (**49**) | PASS | 0 | FAIL (E+M) |
| s10 | 3.29 / 3.83 | 0.8808 | 10/32 (**42**) | **FAIL**: misses `ho-child_sexual_exploitation-pos-02`, `ho2d-…-pos-01`, `ho2d-…-pos-07`, `ho2d-…-bnd-01` | 0 | FAIL (CSE, E+M) |
| s11 | — | — | — | — | — | **not gated: s11 raw outputs were never retrieved** (see archive) |

Two of three seeds fail, so the declared rule fails whatever s11 shows. Ship gates were not run.

**Reference only (primary T=1 / 0.5 / argmax; not decision-bearing, no fallback):**
- s9: E+M 17/20 = 37, CSE pass, sh 0.
- s10: E+M 12/16 = **28**, CSE pass, sh 0.

The val-fitted temperatures (about 3.3–4.0) raise the miss counts sharply (32–33 misses vs 16–20). In this mode the distilled students look under-confident, which is what soft targets tend to produce. Whether to change the decision mode is Justin's call; it is not done here.

## Archive / pod (incomplete; pod NOT terminated)
- VPS `…/shared-adopt/distill/`: 12 checkpoints, s9 raw, s10 raw and logs. `MANIFEST-partial.sha256` (100 files) sha256 `eabfe7729e1bb2247040455b4dd0f64f2ee111f6c386f512a3cb161439defa57`; remote `sha256sum -c` passed at 14:43Z on Oct 15.
- **Exists only on the EXITED pod's 60G volume:** s9 ckpt 2.5 and 3.0. s11 ckpt 1.5, 2.0, 2.5 and 3.0 (if s11 finished), plus s11's raw output and logs. Whether s11 finished training **cannot be checked**: `podResume` was refused 4 times between 14:15 and 14:43Z ("not enough free GPUs on the host machine"), including with gpuCount 0. The volume is tied to that host.
- The pod was not terminated, because terminating would delete those checkpoints. That decision is Justin's.

## Spend
- Pod running 12:02:30Z Oct 14 to 00:13:43Z Oct 15 (when the user exited it): 12.19 h x $0.89 = **$10.85**. About 11.5 h of that was idle. Training finished in about 35 min, but the stream stalled because the VPS disk was full (ENOSPC) and nothing stopped the pod.
- EXITED volume storage, 60 GB at about $0.20/GB-month, 14 h: about $0.23. Still accruing at about $0.40/day.
- **Total about $21.82 of $30.**
