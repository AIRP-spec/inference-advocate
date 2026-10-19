# Where the v3 work lives

**Now:** the top-level `v3/` directory on branch `v3/intern-prep` (draft PR into `main`). Everything in `v3/`
is self-contained (Python stdlib + optional Node, no build), so it can move to its own repository with
history intact:

    git subtree split --prefix v3 -b v3-only     # then push v3-only to the new repo

**Proposed (not created):** a separate public repository, e.g. `AIRP-spec/airp-v3`, for these reasons:

1. **Contamination.** The v2 suite (`data/evaluator-gate/held-out-suite.v2.json`) and v1
   (`held-out-suite.v1.json`) are on `main`. Anyone who clones this repo to work in `v3/` has the full
   protected text on disk, in editor search, and in the context of any coding assistant that indexes the
   checkout. A separate repo removes that by construction. Inside this repo, a v3 author has to avoid it on
   purpose.
2. **The no-copy check becomes absolute.** In a separate repo, `tools/check_no_protected.py` can scan the
   whole tree. Here it can only scan `v3/`, because the rest of the repo legitimately contains v2.
3. **History and review.** v3 item PRs won't mix with the certification, evaluator and deploy PRs (#28–#33).

**If `v3/` stays here,** interns should use a sparse checkout so the protected files are never on disk:

    git clone --filter=blob:none --sparse https://github.com/AIRP-spec/inference-advocate.git
    cd inference-advocate && git sparse-checkout set v3

Creating a new repo is an externally visible step, so it is left to Justin. Nothing in `v3/` depends on the
choice.
