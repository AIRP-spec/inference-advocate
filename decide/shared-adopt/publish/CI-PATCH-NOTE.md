# CI patch note: demo-default bundle (patch file only; not applied, no workflow change pushed)

- **File:** `ci-shared-crosspath-hosted.workflow.patch` adds a `shared-crosspath` job to `.github/workflows/ci.yml`.
  - **GitHub-hosted runner only** (`runs-on: ubuntu-latest`). No self-hosted runner: the repository is public, and a self-hosted runner would run fork code on our hardware.
  - Runs on push to main and workflow_dispatch only, never on pull requests.
  - It checks Python vs Node identity, item by item, for the public bundle avg-f05-s14. That bundle is the tryairp demo default (t164u). It **did not pass AIRP certification** and is **not certified for production**.
- **Fetch (revised 2026-10-23, Justin's choice):** `pip install huggingface_hub==0.34.4`, then `hf download AIRP-spec/airp-shared-primitives-modernbert-large --revision avg-f05-s14 --local-dir <dir>` (public, no token). The bundle is published unpacked; there is **no tarball** on HF, and the old tarball URL and sha (`c126ad6a…`) are removed from the patch.
- **Checks, always (on cache hits too), before use; any failure fails the job and deletes the cached dir:**
  1. `MANIFEST.sha256` hashes to the pinned `SHARED_MANIFEST_SHA256=5f94f2d2d9e5c842cfa07a681e3a9c532c867dae90c3de9ebcfa44dd46275c25`.
  2. `sha256sum --check --strict MANIFEST.sha256` passes in the bundle dir (16 files).
  3. `laya-shared.onnx` = `90b24a0b1ce9b3b3ab0b47a9120c383aafa134c24ceb4b1bd79a451ac5cf8798`; `pins/laya-shared-avg-f05-s14-fp32.pins.json` = `7d3ec1cb494aebf81703fe29963cf31a1621ffdcfb81fbd2da04708398db1158`.
- **Manifest pin and the card edit:** `5f94f2d2…` is the manifest refreshed after Justin's 2026-10-23 card edit (README.md `d51c536e…` → `32b98652…`). It applies once the refreshed manifest is uploaded and the tag re-pointed; before that the tag's manifest was `89101ed9…` with a stale README.md line, and the job fails closed at check 1. **Status at 2026-10-23 ≈11:57 NPT:** already done on HF (main `4300d943…` "MANIFEST.sha256: refresh README.md hash…"; tag avg-f05-s14 resolves to it), so the pin is live.
- **Cache:** `actions/cache` key `shared-bundle-<tag>-<manifest sha>`; a re-pin invalidates it.
- **Validation (2026-10-23):** `git apply --check` OK on main 44e66e9, #32 d7f5056 and decide/shared-adopt 549400d (ci.yml is identical on main and #32); the patched file parses as YAML with jobs `test` and `shared-crosspath`. Dry run of the download and checks on the VPS (hf 0.34.4, fresh dir, current tag → commit 4300d943): manifest sha OK (5f94f2d2), `sha256sum -c` 16/16 OK, ONNX OK, pins OK.
- **Needed with it, on #32 (code, not workflow):** `tools/evaluator-training/laya-shared-crosspath.test.mjs` still pins the A570 pins and `airp-v0.5.0.json`. Move it to `pins/laya-shared-avg-f05-s14-fp32.pins.json` (`7d3ec1cb…`) and composition 2a (`59ddf1f6…`), with goldens refreshed from `rr2/vps/runs/avgs14-v2pins-{python,node}.jsonl`. Without that, the job checks the wrong pins. See MERGE-PLAN step 5.
- **Runner sizing:** the bundle is about 3.4 GB unpacked; the Python reference needs about 3 GB RAM. Both fit a standard hosted runner.
- Justin applies the patch with a workflow-scoped token, after #32 merges. Applying it here is not allowed.
