# Runbook, step 2: switch the tryairp demos to avg-f05-s14 (WRITTEN, NOT EXECUTED)

Status: **draft**. Nothing here has been run. It waits for Justin to upload the bundle (HF-UPLOAD.md) and to approve each tryairp change. dev.tryairp.com goes first; tryairp.com follows only after dev passes every check and Justin says go.

## 0. What the demos run today (checked read-only, 2026-10-19 ~08:50 NPT)

| | tryairp.com | dev.tryairp.com |
|---|---|---|
| pm2 process | `airp-daemon` (pid 1565, up since 2026-10-18 12:55 NPT) | `airp-daemon-dev` (pid 1586, same start) |
| checkout | `/root/inference-advocate`, branch `main` at **a47c4ef** (an ancestor of origin/main d0a0dd7); 1 local edit (`.cursor/rules/inference-advocate.mdc`) | `/root/inference-advocate-dev`, branch `feat/local-evaluator` at **ce1785e** (= origin); **4 tracked files deleted in the working tree**, including `data/models/manifest.json` |
| evaluator selection | `AIRP_EVALUATOR_CONFIG=/root/inference-advocate/.advocate/evaluator.json` | `AIRP_EVALUATOR_CONFIG=/root/inference-advocate-dev/.advocate/evaluator.json` |
| evaluator.json (sha256 `aff923693acd35ac…`, identical in both) | `kind: local`, GGUF `.advocate/models/airp-evaluator-0.6B-v040-step744-Q8_0.gguf`, `modelSha256 3e5d2fd8…`, template v3, CPU | same |
| public `/api/state` warning | "the semantic layer is running local-llm@3e5d2fd83b37+v3 … step744-Q8_0.gguf (template v3)" | same |
| shared-encoding engine in deployed code | **absent** (`packages/evaluator-local/src` has no `laya-shared-evaluator.ts`) | **absent** |

**So:** both demos run **step-744**, selected by an explicit config. The code default `?? { kind: 'rule' }` applies only when `AIRP_EVALUATOR_CONFIG` is unset, and it is set on both. Justin's assumption that step-744 is installed is **correct**.

Consequence: a config change alone cannot switch the demos. The `laya-shared-onnx` engine exists only on **#32** (`adopt/shared-node-evaluator`, d7f5056), which is unmerged. Each demo first needs a **code deploy** containing #32: `packages/evaluator-local` (engine, onnxruntime-node 1.30.0, @huggingface/tokenizers 0.2.0) and `packages/daemon/src/local-evaluator-factory.ts`. #32's code still runs the step-744 GGUF config unchanged (engine omitted = gguf), and that is what keeps rollback to one config change.

## Prerequisites (all Justin's)

1. The bundle is uploaded and public at `https://huggingface.co/AIRP-spec/airp-shared-primitives-modernbert-large/resolve/avg-f05-s14/airp-shared-primitives-avg-f05-s14.tar.gz` with sha256 `541ef498e5184c0111387f069cb92ee24604698e3f8cdc4a382414775dce6596`.
2. A code ref containing #32 is chosen for each demo:
   - **dev:** merge or rebase `feat/local-evaluator` onto a ref containing #32, or deploy #32's head directly. Justin decides which. This is a deploy of unmerged code to dev, which is what dev is for.
   - **prod:** tryairp.com tracks `main`. Either merge the stack first (MERGE-PLAN steps 1–4, then main contains #32), or Justin explicitly approves running prod from a non-main ref. Do not deploy prod from an unmerged branch without that approval.
3. Approval for each tryairp change. This runbook touches no secrets (`AIRP_EVALUATOR_API_KEY` stays as is) and no `.github/` files.

Constants used below:
```bash
TGZ_URL=https://huggingface.co/AIRP-spec/airp-shared-primitives-modernbert-large/resolve/avg-f05-s14/airp-shared-primitives-avg-f05-s14.tar.gz
TGZ_SHA=541ef498e5184c0111387f069cb92ee24604698e3f8cdc4a382414775dce6596
ONNX_SHA=90b24a0b1ce9b3b3ab0b47a9120c383aafa134c24ceb4b1bd79a451ac5cf8798
PINS_SHA=7d3ec1cb494aebf81703fe29963cf31a1621ffdcfb81fbd2da04708398db1158
COMP_SHA=59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e
PY_REF=/root/primitives-evaluator/decide-2026-10-13/shared-adopt/rr/runs/avgs14-rr-id-python.jsonl   # archived Python verdicts, sha 2c66137f349ea024c573c05645cd92d9ac1a6a572ed9a322b4a62ad19bd06451
LOCK=/tmp/airp-vps-bench.lock
```

## A. dev.tryairp.com

**A1. Snapshot (rollback material).**
```bash
D=/root/inference-advocate-dev; TS=$(date -u +%Y%m%dT%H%MZ); B=/root/primitives-evaluator/demo-switch/$TS-dev; mkdir -p $B
git -C $D rev-parse HEAD > $B/HEAD.txt; git -C $D status --porcelain > $B/status.txt; git -C $D diff > $B/worktree.diff
cp -a $D/.advocate/evaluator.json $B/evaluator.step744.json; sha256sum $B/evaluator.step744.json   # expect aff923693acd35ac…
sha256sum $D/.advocate/models/airp-evaluator-0.6B-v040-step744-Q8_0.gguf                         # expect 3e5d2fd8…; this file is never touched
curl -s https://dev.tryairp.com/api/state | python3 -c "import sys,json;print([w for w in json.load(sys.stdin)['warnings'] if 'semantic layer' in w])" > $B/state-before.txt
pm2 describe airp-daemon-dev > $B/pm2-before.txt
```
**STOP if the dev worktree's 4 deleted tracked files** (`.cursor/rules/inference-advocate.mdc`, `.private/README.md`, `data/evaluator-training/README.md`, `data/models/manifest.json`) are not explained. Ask Justin before any checkout restores or discards them.

**A2. Fetch and verify the published bundle** (outside the checkout; the GGUF stays where it is).
```bash
M=$D/.advocate/models/shared-avg-f05-s14; mkdir -p $M && cd $M
curl -fL --retry 3 -o bundle.tgz "$TGZ_URL" && echo "$TGZ_SHA  bundle.tgz" | sha256sum -c -
tar -xzf bundle.tgz && cd airp-shared-primitives-avg-f05-s14 && sha256sum -c MANIFEST.sha256
[ "$(sha256sum laya-shared.onnx | cut -d' ' -f1)" = $ONNX_SHA ] && [ "$(sha256sum pins/laya-shared-avg-f05-s14-fp32.pins.json | cut -d' ' -f1)" = $PINS_SHA ] \
  && [ "$(sha256sum compositions/airp-v0.5.0-cse-corrected-2a.json | cut -d' ' -f1)" = $COMP_SHA ] && echo BUNDLE_OK
```

**A3. Deploy the code containing #32** (the ref Justin chose), then build.
```bash
cd $D && git fetch origin && git checkout <APPROVED_REF> && npm ci && npm run build
git rev-parse HEAD > $B/HEAD-new.txt
# Still on step-744: restart and confirm nothing changed before switching models.
pm2 restart airp-daemon-dev --update-env && sleep 15
curl -s https://dev.tryairp.com/api/state | grep -o 'local-llm@3e5d2fd83b37+v3'                 # must still print
```

**A4. Switch the config (the one change).** Write the new config next to the old one, then swap:
```bash
SH=$M/airp-shared-primitives-avg-f05-s14
cat > $D/.advocate/evaluator.shared-avg-f05-s14.json <<JSON
{
 "kind": "local",
 "engine": "laya-shared-onnx",
 "modelPath": "$SH/laya-shared.onnx",
 "modelSha256": "$ONNX_SHA",
 "laya": {
  "pinsPath": "$SH/pins/laya-shared-avg-f05-s14-fp32.pins.json", "pinsSha256": "$PINS_SHA",
  "compositionPath": "$SH/compositions/airp-v0.5.0-cse-corrected-2a.json", "compositionSha256": "$COMP_SHA",
  "intraOpNumThreads": 8
 },
 "note": "avg-f05-s14-ep2.0-2.5-3.0, demo default (not certified for production). Rollback: copy evaluator.step744.json over evaluator.json and pm2 restart."
}
JSON
cp -a $D/.advocate/evaluator.json $D/.advocate/evaluator.step744.json        # step-744 config kept, switchable back
cp $D/.advocate/evaluator.shared-avg-f05-s14.json $D/.advocate/evaluator.json
pm2 restart airp-daemon-dev --update-env && sleep 20
curl -s https://dev.tryairp.com/api/state | python3 -c "import sys,json;print([w for w in json.load(sys.stdin)['warnings'] if 'semantic layer' in w])"
# expect: "... running local-laya-shared@90b24a0b1ce9+laya-shared-pins-7d3ec1cb494a on-device against laya-shared.onnx (engine laya-shared-onnx, ...)"
```
(`intraOpNumThreads` is optional in #32's config; drop it if Justin wants the ORT default.)

**A5. Identity on the live code path: 471 items vs the archived Python verdicts.** This uses the deployed checkout's built `dist/` (the same modules the daemon loads), the deployed bundle, and the deployed config's pins and composition, under flock and a 9 GB cgroup:
```bash
cd $D && O=/root/primitives-evaluator/demo-switch/$TS-dev/identity && mkdir -p $O
SUITE=$D/data/evaluator-gate/held-out-suite.v2.json   # content identical to 6c7b30e1 / 82f8e720 (only bnd-05 gold differs)
python3 -c "import json;json.dump({'ids':[i['id'] for i in json.load(open('$SUITE'))['items']]},open('$O/ids.json','w'))"
flock $LOCK nice -n 10 systemd-run --scope --quiet -p MemoryMax=9G -p MemorySwapMax=0 \
  node tools/evaluator-training/laya-shared-node/crosspath/node_path_shared.mjs --bundle $SH --pins $SH/pins/laya-shared-avg-f05-s14-fp32.pins.json \
  --pins-sha $PINS_SHA --composition $SH/compositions/airp-v0.5.0-cse-corrected-2a.json --composition-sha $COMP_SHA --threads 8 --warmup 20 \
  --suite $SUITE --ids $O/ids.json --out $O/live-node.jsonl --summary $O/live-node-summary.json
node tools/evaluator-training/laya-node/crosspath/compare.mjs --python $PY_REF --node $O/live-node.jsonl \
  --pins $SH/pins/laya-shared-avg-f05-s14-fp32.pins.json --composition $SH/compositions/airp-v0.5.0-cse-corrected-2a.json --out $O/compare.json
# PASS = CROSSPATH_PASS, n 471: primsIdentical, composedIdentical, decodeIdentical, feedIdentical all 471. Any problem → rollback (R).
```

**A6. Smoke test: ten mixed inputs on the deployed code path.**
- `smoke10.mjs` (in this folder; copy it to `/root/primitives-evaluator/demo-switch/` first) builds an evaluator exactly as the daemon does: it reads the config named by `AIRP_EVALUATOR_CONFIG` and calls the deployed checkout's `createOnDeviceEvaluator` from its built `dist/`. It is a separate process with its own model instance; it does not talk to the running daemon.
- It feeds ten held-out items of mixed kinds: 2 clean, persona_claims, relational_hooks, sycophancy, self_harm (pos-04 and pos-12, the two step-744 misses), violence, hate, and the CSE refusal counter `ctr-03`. It checks each composed verdict against composition 2a applied to the archived Python primitives.
- Dry run on the box (not a demo host), 2026-10-19 09:10 NPT, #32 d7f5056 code, same ONNX and composition: `SMOKE_PASS 10/10` (`smoke10-box-dryrun.log`). `ho-persona_claims-pos-02` composes to relational_hooks in both paths (a known model miss, not a path mismatch).
- Then do one end-to-end `/api/ask` round through the dev UI and confirm the transcript shows a verdict and no evaluator error.
```bash
mkdir -p /root/primitives-evaluator/demo-switch && cp <repo>/decide/shared-adopt/runbook/smoke10.mjs /root/primitives-evaluator/demo-switch/
cd $D && AIRP_EVALUATOR_CONFIG=$D/.advocate/evaluator.json flock $LOCK node /root/primitives-evaluator/demo-switch/smoke10.mjs $D $PY_REF
# expect: SMOKE_PASS 10/10
```

**A7. Record live hashes.** Write these to `$B/LIVE.txt` and report them:
- `git rev-parse HEAD`
- `sha256sum .advocate/evaluator.json`
- ONNX, pins and composition shas
- the `/api/state` warning line
- `pm2 describe airp-daemon-dev` (uptime, restarts)
- the Node 500-token median: run the `lengths` step from `vps_shared_node_rr.sh` against the deployed bundle; the target is < 1000 ms. Four pre-switch runs on this host ranged 677–997 ms (one run at 997 ms while the host was busy), so run it at least twice and report every run.

**Dev passes** when A2, A5 and A6 pass, `/api/state` names `local-laya-shared@90b24a0b1ce9`, and pm2 shows no restart loop for 30 min. Then STOP and report to Justin before prod.

## B. tryairp.com (only after dev passes and Justin says go)

Same as A, with:
- `D=/root/inference-advocate`
- pm2 `airp-daemon`
- URL `https://tryairp.com`
- backups under `…/demo-switch/$TS-prod`
- `<APPROVED_REF>` = merged `main` containing #32, or the ref Justin approved

Before A3, keep the prod-local edit to `.cursor/rules/inference-advocate.mdc`: it is in `$B/worktree.diff`. Do not discard it without asking. Report the live hashes as in A7.

## R. Rollback (either demo, one config change)

```bash
cp -a $D/.advocate/evaluator.step744.json $D/.advocate/evaluator.json      # sha aff923693acd35ac…
pm2 restart <airp-daemon-dev|airp-daemon> --update-env && sleep 15
curl -s https://<dev.>tryairp.com/api/state | grep -o 'local-llm@3e5d2fd83b37+v3'   # back on step-744
```
- The step-744 GGUF and its config are never deleted, so this works for as long as #32's code is deployed (it still serves the GGUF engine).
- **Code rollback** (only if #32's code itself misbehaves): `git -C $D checkout $(cat $B/HEAD.txt) && (cd $D && npm ci && npm run build)`, restore `$B/worktree.diff` if needed, then restore `evaluator.step744.json` and run `pm2 restart`.
- **Capacity note:** after both demos switch, two daemons each hold the ONNX model and each run ONNX Runtime with 8 threads on the same 8 vCPUs. Concurrent requests on dev and prod will slow each other; consider `intraOpNumThreads: 4` for dev.
- **Triggers:** any identity mismatch; any smoke failure; daemon restart loop; 500-token median ≥ 1000 ms on the live host; `/api/state` not naming the expected evaluator; RSS pushing the 15 GiB host (each daemon holds about 2.5–2.9 GB with the ONNX model, against step-744's 0.6B Q8_0).
