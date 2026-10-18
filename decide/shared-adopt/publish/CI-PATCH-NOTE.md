# CI patch note: research release (patch file only; not applied, no workflow change pushed)

- **File:** `ci-shared-crosspath-hosted.workflow.patch` adds a `shared-crosspath` job to `.github/workflows/ci.yml`.
  - It runs on a GitHub-hosted runner, on push to main or workflow_dispatch only, never on pull requests.
  - It checks Python vs Node identity for the **NON-DEFAULT RESEARCH RELEASE** bundle avg-f05-s14, which **did not pass AIRP certification**.
- **Pinned now:** the default `SHARED_BUNDLE_URL` points at `AIRP-spec/airp-shared-primitives-modernbert-large-research` at tag `research-avg-f05-s14`, file `airp-shared-primitives-research-avg-f05-s14.tar.gz`. The repository variable `AIRP_SHARED_BUNDLE_URL` overrides it.
- **Still a placeholder (by design):** `SHARED_BUNDLE_SHA256`. The "refuse placeholders" step fails the job until it is pinned in a reviewed commit, after Justin uploads.
  - The tarball built on the VPS has sha256 `23474ee74633b32556089781f1c36900e875de857a2cfe71dc9ace6a5916a4f7` (see FINDINGS). That is the value to pin, provided README.md is not edited before upload. If it is edited, rebuild the tarball and pin the new sha.
- **`git apply --check`:** OK on decide/shared-adopt HEAD, origin/main ci.yml (d0a0dd7) and #32 (d7f5056), checked 2026-10-19.
- **Needed with it, on #32 (code, not workflow):** `tools/evaluator-training/laya-shared-crosspath.test.mjs` still pins the A570 pins file and composition `airp-v0.5.0.json`. It must move to `laya-shared-avg-f05-s14-RESEARCH.pins.json` (`8ef0b322…`) and composition 2a (`59ddf1f6…`), with goldens refreshed from `rr/vps/runs/avgs14-rr-id-*.jsonl`. Without that, the job checks the wrong bundle. Apply the patch only if Justin decides #32 carries the research engine (merge plan step 4).
- Justin applies it with a workflow-scoped token. Applying it here is not allowed.
