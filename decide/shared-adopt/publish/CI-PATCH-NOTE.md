# CI patch note (patch file only; not applied, not pushed as a workflow change)

- File: `ci-shared-crosspath-hosted.workflow.patch` adds a `shared-crosspath` job to `.github/workflows/ci.yml`. It runs on a GitHub-hosted runner, only on push to main or workflow_dispatch, never on pull requests.
- **Placeholders:** `SHARED_BUNDLE_URL`, which points at the proposed HF repo with `REPLACE_WITH_CERTIFIED_TAG` (override with the repository variable `AIRP_SHARED_BUNDLE_URL`), and `SHARED_BUNDLE_SHA256` = `REPLACE_WHEN_BUNDLE_PUBLISHED_…`. A "refuse placeholders" step fails the job until both are pinned in a reviewed commit.
- Checked with `git apply --check`: OK on decide/shared-adopt (HEAD at drafting), on adopt/shared-node-evaluator (#32, d7f5056), and against main's ci.yml (`d0a0dd7`, identical file).
- **Needed with it, on #32 (code, not workflow):** `tools/evaluator-training/laya-shared-crosspath.test.mjs` still pins the A570 pins file and the old composition `airp-v0.5.0.json`. When a model certifies, #32 gets the new pins file and corrected composition constants plus refreshed fixed-item goldens. Otherwise this job checks the wrong bundle.
- Justin applies it with a workflow-scoped token after the bundle is public. Applying it here is not allowed.
