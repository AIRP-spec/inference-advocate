# CI patch note: demo-default bundle (patch file only; not applied, no workflow change pushed)

- **File:** `ci-shared-crosspath-hosted.workflow.patch` adds a `shared-crosspath` job to `.github/workflows/ci.yml`.
  - **GitHub-hosted runner only** (`runs-on: ubuntu-latest`). No self-hosted runner: the repository is public, and a self-hosted runner would run fork code on our hardware.
  - Runs on push to main and workflow_dispatch only, never on pull requests.
  - It checks Python vs Node identity, item by item, for the public bundle avg-f05-s14. That bundle is the tryairp demo default (t164u). It **did not pass AIRP certification** and is **not certified for production**.
- **Pinned URL:** `https://huggingface.co/AIRP-spec/airp-shared-primitives-modernbert-large/resolve/avg-f05-s14/airp-shared-primitives-avg-f05-s14.tar.gz`. The repository variable `AIRP_SHARED_BUNDLE_URL` overrides it.
- **Pinned SHA-256:** `541ef498e5184c0111387f069cb92ee24604698e3f8cdc4a382414775dce6596`, the tarball built and re-verified on the VPS 2026-10-19 (MANIFEST `e485d497…`, 16 files).
  - Choice: the real sha is pinned rather than a placeholder. The job fails closed (sha check before extract, on cache hits too) until that exact file is public, so pinning early is safe and saves a follow-up commit.
  - If any bundle file is edited before upload, the tarball sha changes: rebuild and re-pin here, in HF-UPLOAD.md and in the runbook.
  - The "refuse placeholders" step stays as a guard against a placeholder URL set through the repository variable.
- **`git apply --check`:** OK on decide/shared-adopt HEAD (fcc5b5d), main (d0a0dd7) and #32 (d7f5056), checked 2026-10-19; the patched file parses as YAML with jobs `test` and `shared-crosspath`.
- **Needed with it, on #32 (code, not workflow):** `tools/evaluator-training/laya-shared-crosspath.test.mjs` still pins the A570 pins and `airp-v0.5.0.json`. Move it to `pins/laya-shared-avg-f05-s14-fp32.pins.json` (`7d3ec1cb…`) and composition 2a (`59ddf1f6…`), with goldens refreshed from `rr2/vps/runs/avgs14-v2pins-{python,node}.jsonl`. Without that, the job checks the wrong pins. See MERGE-PLAN step 5.
- **Runner sizing:** the bundle is 1.77 GB compressed and about 3.4 GB extracted; the Python reference needs about 3 GB RAM. Both fit a standard hosted runner.
- Justin applies the patch with a workflow-scoped token, after upload and after #32 merges. Applying it here is not allowed.
