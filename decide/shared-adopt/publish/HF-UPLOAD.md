# Hugging Face repo and upload command (DO NOT RUN; Justin uploads with a repo-scoped token)

**Decision (Justin, t164u, 2026-10-19):** avg-f05-s14 is approved. It becomes the **default evaluator on the tryairp.com and dev.tryairp.com demos** after upload (runbook step 2). It is **not certified for production**. Everything in AIRP is open, so the repo is **public**.

- **Repo:** `AIRP-spec/airp-shared-primitives-modernbert-large` (public).
  - The earlier proposal's `-research` suffix is dropped, because this is now the demo default, not a side release. The card's banner carries the "not certified" status.
  - If Justin prefers to keep the suffix, replace the repo id everywhere below and in the CI patch.
  - Whether a Hugging Face org named `AIRP-spec` exists was not checked. Use Justin's namespace if it does not.
- **Revision tag:** `avg-f05-s14` (immutable pointer for the demo config and CI). `main` holds the same commit.
- **Contents:** the verified bundle directory (README = model card; 16 files plus MANIFEST.sha256) and the deterministic tarball the CI job downloads.

## Token

A **fine-grained** token scoped to this one repo, with write access ("Write access to contents/settings of selected repos"). A fine-grained token can only be scoped to a repo that already exists, so:

1. Create the empty public repo once in the web UI: huggingface.co → New model → owner `AIRP-spec`, name `airp-shared-primitives-modernbert-large`, visibility **Public**, license apache-2.0. A token with org-level "create repos" permission can do this instead.
2. Settings → Access Tokens → Fine-grained → Repositories permissions → add `AIRP-spec/airp-shared-primitives-modernbert-large` → "Write access to contents/settings". No other scopes.
3. Never paste the token on the command line or into a file. Read it into the environment for one shell only, as below.

## Commands (on the VPS, from the verified bundle)

```bash
cd /root/primitives-evaluator/decide-2026-10-13/shared-adopt/rr2/release
sha256sum -c airp-shared-primitives-avg-f05-s14.tar.gz.sha256                  # tarball OK
cd airp-shared-primitives-avg-f05-s14 && sha256sum -c MANIFEST.sha256           # every file OK
read -rs HF_TOKEN && export HF_TOKEN                                            # paste the repo-scoped token; not echoed, not in history
REPO=AIRP-spec/airp-shared-primitives-modernbert-large
hf upload "$REPO" . . --repo-type model \
  --commit-message "avg-f05-s14-ep2.0-2.5-3.0: tryairp demo default evaluator (not certified for production)" \
  --commit-description "Selection 4237006; ADR 20ef5c3 + clarification 95d53e5; approved t164u. MANIFEST.sha256 e485d4974d55472952c35d0766b44ad5e59c60ec1ce77b75c6850179ecd449fb; tarball 541ef498e5184c0111387f069cb92ee24604698e3f8cdc4a382414775dce6596."
hf upload "$REPO" ../airp-shared-primitives-avg-f05-s14.tar.gz airp-shared-primitives-avg-f05-s14.tar.gz \
  --repo-type model --commit-message "Deterministic bundle tarball (CI + demo deploy)"
hf repo tag create "$REPO" avg-f05-s14 -m "avg-f05-s14-ep2.0-2.5-3.0, tryairp demo default (not certified)"   # hf >= 1.0: 'hf repos tag create'
unset HF_TOKEN
# Verify the public download matches (no token needed):
curl -fL -o /tmp/check.tgz "https://huggingface.co/$REPO/resolve/avg-f05-s14/airp-shared-primitives-avg-f05-s14.tar.gz" \
  && echo "541ef498e5184c0111387f069cb92ee24604698e3f8cdc4a382414775dce6596  /tmp/check.tgz" | sha256sum -c -
```

Notes:
- There is no `--private` anywhere. The repo is created in the web UI as Public. If it ever shows as private, switch it in the repo's Settings page (newer CLIs also have `hf repos settings "$REPO" --private false`; the VPS CLI does not).
- `hf upload` would auto-create the repo, but the fine-grained token cannot create repos, so step 1 comes first.
- CLI syntax: the VPS has `hf` from huggingface_hub **0.34.4** (`/usr/local/bin/hf`), checked 2026-10-19 with `--help`: `hf upload [repo_id] [local_path] [path_in_repo] --repo-type --commit-message --commit-description`, `hf repo tag create repo_id tag -m`. The current online guide names the group `hf repos`; with 0.34.4 it is `hf repo`. `HF_TOKEN` in the environment is honoured by both.
- The tarball sha is already pinned in the CI patch and the demo runbook. It changes only if a bundle file is edited and the bundle rebuilt; then re-pin all three.
