# Proposed Hugging Face repo and upload command: research release (DO NOT RUN; Justin uploads)

**NON-DEFAULT RESEARCH RELEASE.** avg-f05-s14-ep2.0-2.5-3.0 did **not** pass AIRP certification. Certification stopped under ADR 2026-10-19.

- **Proposed repo:** `AIRP-spec/airp-shared-primitives-modernbert-large-research`. The `-research` suffix keeps it apart from any future certified repo. Whether a Hugging Face org named `AIRP-spec` exists was not checked; use Justin's namespace if it does not.
- **Revision tag:** `research-avg-f05-s14`.
- **Visibility:** created **private**. Making it public is a separate decision for Justin.

Run by Justin on the VPS (or on a copy verified with `sha256sum -c`):

```bash
cd /root/primitives-evaluator/decide-2026-10-13/shared-adopt/rr/release/airp-shared-primitives-research-avg-f05-s14
sha256sum -c MANIFEST.sha256                                       # must print OK for every file
hf auth login                                                      # Justin's account, write token
hf repos create AIRP-spec/airp-shared-primitives-modernbert-large-research --repo-type model --private
hf upload AIRP-spec/airp-shared-primitives-modernbert-large-research . . --repo-type model \
  --commit-message "NON-DEFAULT RESEARCH RELEASE avg-f05-s14-ep2.0-2.5-3.0 (did not pass AIRP certification)" \
  --commit-description "Selection 4237006; ADR 20ef5c3 + clarification 95d53e5; MANIFEST.sha256 <sha from FINDINGS>. Certification stopped per ADR 2026-10-19. Not a default evaluator."
hf upload AIRP-spec/airp-shared-primitives-modernbert-large-research ../airp-shared-primitives-research-avg-f05-s14.tar.gz \
  airp-shared-primitives-research-avg-f05-s14.tar.gz --repo-type model --commit-message "CI tarball (deterministic)"
hf repos tag create AIRP-spec/airp-shared-primitives-modernbert-large-research research-avg-f05-s14
# Public only when Justin decides:
# hf repos settings AIRP-spec/airp-shared-primitives-modernbert-large-research --private false
```

The CLI syntax was checked against the huggingface_hub CLI guide on 2026-10-18 (`hf repos create`, `hf upload [repo_id] [local_path] [path_in_repo]`, `hf repos tag create`, `hf repos settings --private`).
