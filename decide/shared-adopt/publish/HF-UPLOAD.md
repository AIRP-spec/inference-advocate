# Proposed Hugging Face repo and upload command (DO NOT RUN; Justin uploads)

- **Proposed repo:** `AIRP-spec/airp-shared-primitives-modernbert-large`. Whether a Hugging Face org named `AIRP-spec` exists was not checked. Use Justin's namespace if it does not.
- **Revision tag:** `fresh06-s<seed>-ep3.0` (the certified checkpoint), with `main` pointing at the same commit.

Run by Justin, from the verified bundle directory, after the certification passes every ship gate:

```bash
cd /path/to/bundle-<tag> && sha256sum -c MANIFEST.sha256          # must print OK for every file
hf auth login                                                      # Justin's account, write token
hf repos create AIRP-spec/airp-shared-primitives-modernbert-large --repo-type model --private
hf upload AIRP-spec/airp-shared-primitives-modernbert-large . . --repo-type model \
  --commit-message "Certified shared-encoding primitives evaluator fresh06-s<seed> epoch 3.0" \
  --commit-description "Declaration <sha>; report <sha>; MANIFEST.sha256 <sha>. Does not pass the AIRP held-out gate; see README."
hf repos tag create AIRP-spec/airp-shared-primitives-modernbert-large fresh06-s<seed>-ep3.0
# Make public only when Justin decides:
# hf repos settings AIRP-spec/airp-shared-primitives-modernbert-large --private false
```

The CLI syntax was checked against the huggingface_hub CLI guide (https://huggingface.co/docs/huggingface_hub/main/en/guides/cli, accessed 2026-10-18): `hf repos create`, `hf upload [repo_id] [local_path] [path_in_repo]`, `hf repos tag create`, `hf repos settings --private`.
