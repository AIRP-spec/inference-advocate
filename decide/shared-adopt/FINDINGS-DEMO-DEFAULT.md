# Findings: avg-f05-s14 as tryairp demo default (t164u, step 1 of 2)

2026-10-19 (NPT, UTC+5:45). Step 1 only: package rebuilt, nothing uploaded, nothing deployed, tryairp untouched, no merges.

## Bundle (VPS, rebuilt after the card change)

| item | value |
|---|---|
| directory | `/root/primitives-evaluator/decide-2026-10-13/shared-adopt/rr2/release/airp-shared-primitives-avg-f05-s14/` (16 files + MANIFEST) |
| MANIFEST.sha256 | `e485d4974d55472952c35d0766b44ad5e59c60ec1ce77b75c6850179ecd449fb` |
| tarball `airp-shared-primitives-avg-f05-s14.tar.gz` | `541ef498e5184c0111387f069cb92ee24604698e3f8cdc4a382414775dce6596` (1 767 093 724 bytes) |
| re-verification | extracted to a scratch dir, `sha256sum -c MANIFEST.sha256` OK (16/16), extracted MANIFEST byte-identical |
| README.md (card) / NOTICE / reports/RELEASE.md | `7059aa34…` / `d3fd06ea…` / `02f1587b…` (= `rr2/bundle-src/`) |
| pins | `pins/laya-shared-avg-f05-s14-fp32.pins.json` `7d3ec1cb…` (name/note only changed vs `8ef0b322…`; other fields asserted identical) |
| identity on new pins | CROSSPATH_PASS 471/471 (prims, composed, decode, feeds), max Δ 2.04e-4, min margin 0.097; Python logits+prims identical to the t161u record |
| superseded | t161u research bundle `airp-shared-primitives-research-avg-f05-s14` (`23474ee7…`): do not upload |

## What the demos run today (read-only)

Both demos run **step-744** (`local-llm@3e5d2fd83b37+v3`) through an explicit `AIRP_EVALUATOR_CONFIG` (`.advocate/evaluator.json` `aff92369…`, identical on both). The package default `?? { kind: 'rule' }` does not apply on either. Justin's assumption that step-744 is installed is correct. Details in `runbook/DEMO-SWITCH-RUNBOOK.md` §0.

## Conflicts with Justin's assumptions

1. **"Tie" with step-744.** On this artifact it is not a tie: v2 E+M 27 vs 33 (6 better; E 14 vs 21, M 13 vs 12). For the *recipe* it is roughly a tie: 9 averaged models, mean 31.78, SD 3.77, range 27–37, i.e. 6 better to 4 worse. The card says this.
2. **The switch is a code deploy, not a config change.** The deployed demo code has no `laya-shared-onnx` engine; only #32 has it. Prod tracks `main` (a47c4ef, behind origin/main d0a0dd7), so prod needs #32 merged, or Justin's approval to run a non-main ref.
3. **#29 is inside #32** (a718ff5 is an ancestor of d7f5056). Merging #32 lands #29; #29 should be closed, not merged.
4. **Demo worktrees are not clean.** dev (`feat/local-evaluator` ce1785e) has 4 tracked files deleted, including `data/models/manifest.json`; prod has a local edit to `.cursor/rules/inference-advocate.mdc`. The runbook stops on these.
5. **step-744 was trained on taxonomy v0.4.0; the demos load v0.5.0.** Its v1-207 went from 1/0 (its own note) to 2/1 (old gold) and 3/1 (amended).
6. **Latency hosts differ.** step-744 cannot be benchmarked on the demo host while it serves there, so the head-to-head is on the box (same host, same inputs): ~500 tokens 442/529 ms vs 1102/1247 ms; suite 36/48 vs 332/487 ms (median/p95). On the demo host the shared model's 500-token median varied 677–997 ms across four runs; it is near the 1000 ms ship check when the host is busy.
7. **Two daemons on one 8-vCPU host.** After both demos switch, each daemon holds about 2.5–2.9 GB and runs 8 ORT threads on the same cores.
8. **HF CLI on the VPS is huggingface_hub 0.34.4:** the command group is `hf repo`, not `hf repos`, and there is no `repos settings`. HF-UPLOAD.md uses the installed syntax.
9. **HF org `AIRP-spec`:** existence not checked; Justin creates the repo in the web UI.

## t165u update (2026-10-19 17:13–17:35 NPT)

- **Card fix:** the step-744 amended-gold record is now cited as `live-baseline/step744-limit-after-bnd05.json` (`d7e7168e…`, under `decide/shared-adopt/`). README.md is the only bundle file that changed (`7059aa34…` → `d51c536e…`).
- **Rebuilt bundle (upload THIS one):** MANIFEST.sha256 `89101ed92fdd8e7d3ab03a8b7a303bb3cbd5eda26025827642612c37ff8f6e8c` (16 files); tarball `c126ad6a31de2c954f43ebe2e5a0607c316fb94b338427117a8e69acdfcef119` (1 767 093 757 bytes). The script re-checked the manifest in place, then extracted the tarball and checked it again (16/16). **`541ef498…` / `e485d497…` are superseded.**
- **Identity re-run** on the built release files (its own ONNX, pins `7d3ec1cb…`, composition 2a): CROSSPATH_PASS 471/471 (prims, composed, decode, feeds), max Δ 2.04e-4, min margin 0.097. The Python logits and prims are identical to the archived record `avgs14-rr-id-python.jsonl` (`2c66137f…`).
- **Demo checkouts:** clean on both; details in runbook §0b. Prod is now main 44e66e9, because Justin committed the `.cursor/rules` edit. Trial merges against the new main (44e66e9) are still clean for #28, #32, #33 and #31.
- **Gate:** the HF repo is not public yet (401 for the repo, 404 for the `AIRP-spec` org page). The dev switch has not been started.
