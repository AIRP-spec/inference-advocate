# Sealed v3 and v3-safety hashes (recorded 2026-11-21 14:55 NPT)

**Status: record only.** No corpus was opened, copied, scored, or published. Hashes and counts were read from VPS manifests and re-checked with `sha256sum` on the VPS in this session (2026-11-21 ~09:10Z / 14:55 NPT, Asia/Katmandu, UTC+5:45).

## v3-safety (sealed)

| file | path on the Nepal VPS | sha256 | n rows (wc -l) |
|---|---|---|---:|
| seal | `/root/primitives-evaluator/v3-safety-20261102/v3/sealed/v3-safety.jsonl` | `2dc0e7d8bef4848a8f0ce1e1179118a0ebef62bc92fe0a2e7cc87c2c2fe5c514` | 145 |
| reserve (sealed, unused; using it needs a signature) | `/root/primitives-evaluator/v3-safety-20261102/v3/sealed/reserve/v3-safety-reserve.jsonl` | `ee7a4658537f76bd6c560c6a68e9e01b055bfac105e30830d9651e85b0876068` | 72 |

`MANIFEST.summary.json` on the seal: n_in 145, n_kept 145, n_dropped_leak 0, sealed_sha256 matches the line above. Fresh `sha256sum` of both files in this session matched the manifests. These are the same pins used in the pack v10g V-g checks (`headext/evidence/g7x/vg-vps.json`).

The signed v3-safety declaration (`V3-SAFETY-DECLARATION-signed-f9535f4a.md`, t212u) is the authority for how this set was built. The sealed file is not published as content.

## v3 (main evaluation corpus)

**Not sealed.** The head-extension sizing addendum already recorded that the "v3 sealed" corpus of V-g did not exist yet. A search of the Nepal VPS on 2026-11-21 (protected-tree names and manifest files only; no corpus text read) found no later `v3.jsonl` seal or `MANIFEST.sha256` for a main v3 evaluation set. Held-out v2 / v1-207 fingerprints in `/root/airp-protected` are unchanged (`82f8e720…`, `f577129b…`) and are not a v3 seal.

Consequence, for the drafts that follow: v3-safety can be named by hash today; a v3 score cannot start until a main v3 seal exists, its sha256 is recorded the same way as above, and the rate-based gate ADR plus the certification-run declaration are signed. This record does not seal v3.

## What was not done

No row text was read. No leak check was re-run. No reserve was used. No score.
