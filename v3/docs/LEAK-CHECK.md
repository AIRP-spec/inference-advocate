# Leak checks: how to run them without seeing protected content

There are two tools. Neither one ever prints protected text.

## 1. `tools/check_no_protected.py` (anyone, CI-free)

Confirms that nothing committed under `v3/` contains a v2 or v1-207 held-out **id** or **text**. It uses
only `tools/protected-fingerprints.json`, which holds hashes and no text: 471 id hashes, 128 short-item
hashes, and 1,704 word-8-gram hashes, built from the v2 suite `82f8e720…` and v1-207 `f577129b…`.

    cd v3 && python3 tools/check_no_protected.py        # exit 0 = clean
    ln -s ../../v3/tools/pre-commit ../.git/hooks/pre-commit   # optional local hook

A hit prints `path:line: kind` (kind = `id`, `text-8gram`, `text-shortN`; line 0 means inside a decoded JSON
string). Remove the line. Never "fix" a hit by editing the fingerprints.

Known limits: items under 4 words (15 of them) are not fingerprinted. Paraphrases are not caught; the blind
check below catches those. Hashes of short n-grams can be brute-forced. That doesn't matter here, because
the v2 suite is public on `main`, but don't reuse this scheme for genuinely secret text.

## 2. `airp_v3.leakcheck` (blind, operator-run)

Input is a **file hash**. Output is the colliding **candidate ids** only. It uses the same rules as
`tools/evaluator-training/leak.mjs`, which every corpus round has used: exact match after normalisation,
substring when both sides are at least 40 characters, word-4-gram Jaccard of at least 0.5, plus a
candidate id equal to a protected id.

The protected files live outside this repository. On the VPS they're under `/root/airp-protected/`
(`held-out-suite.v2.json`, `held-out-suite.v1.json`, pinned by sha256), with `/root/airp-protected/inbox/`
for candidate files. The tool refuses a protected directory inside the repo checkout, and it refuses a
protected file whose sha256 isn't pinned.

### Intern workflow (no access to protected content needed)

1. Write the candidate file (JSONL with `id` and `content`) in your v3 working branch.
2. `sha256sum items.jsonl` and post **only the hash** in the PR or issue ("leak-check please: <hash>").
3. The operator (Justin, or an agent acting for him) copies the file by hash into the inbox and runs:

       python3 -m airp_v3.leakcheck --sha256 <hash>          # on the VPS, from v3/
       # or: --file PATH --protected-dir DIR  (anywhere the protected dir exists)

4. The operator posts back the JSON: `candidate_sha256`, `protected_pins`, `n_candidates`,
   `n_colliding`, `colliding_ids`. Rewrite or drop those ids. Don't try to work out what they matched.
   Then re-hash and repeat until `n_colliding` is 0.

The output never contains protected text, protected ids, the matched rule, or which protected item was hit.
The one exception: if your own candidate id equals a protected id, it is listed, because it is your id.

### Why not just give interns the suite?

v2 has been public on `main` since 2026-09, so the ids and text can be read there. The point of the blind
workflow is that **v3 authors should not read v2 while writing v3**. Reading it would make v3 a paraphrase
of v2 rather than an independent test. See LOCATION.md for the checkout advice that goes with this.
