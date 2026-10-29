# Compositions

A composition file maps the evaluator's primitives (`../vocabulary.json`: 5 stances, 7 objects, 9 qualifiers)
to one policy's classes. The model never sees it; swapping the file swaps the policy with no retrain.
`compose.mjs` loads a file and calls the single compose core in `packages/evaluator-local/src/compose-primitives.ts`.

| File | Policy |
|---|---|
| `airp-v0.5.0.json`, `airp-v0.5.0-cse-corrected*.json` | AIRP v0.5.0 (11 classes; the demo default composes with `-cse-corrected-2a`) |
| `ailuminate-v1.0.json` | MLCommons AILuminate v1.0 (3 hazards `unsupported`) |
| `ny-s9051-v1.json` | New York S9051-B, Gen. Bus. Law § 1800(8) features (a)-(l). Exploratory research composition, not legal advice |

## `support` levels (ny-s9051-v1.json)

Each class in the New York file carries `support`, a `citation` to the subsection it implements, and the
statute's own words in `statuteText` (verbatim from `sources/ny-s9051-B.txt`).

- **covered**: the rule implements the feature from existing primitives: (a), (d), (g), the suicide and self-harm part of (i), and (l).
- **partial**: the feature is judged from one response, but a primitive it needs does not exist yet; `missingPrimitives`
  names it. Where existing primitives carry part of the feature, the rule fires on that part ((b), (c), (j)); a fire is
  evidence of the feature, a non-fire is not evidence of its absence. Where none do, `rule` is `null` ((e), and the
  disordered-eating and drug/alcohol part of (i)).
- **host-evidence**: not a property of a single response ((f) stored-information use, (k) engagement design). `rule` is
  `null`; the host's records are the evidence, not the evaluator.
- **pending-regulation**: defined by Attorney General regulation not yet promulgated ((h)). `rule` is `null`.

## Host-attested inputs

A composition may declare `hostInputs`: facts the host attests and the model never predicts. The New York file declares
`host.covered_minor` and gates every rule on it; it is never derived from `subject_is_minor`. Under § 1801(1) the features
are unlawful for any covered user unless the operator has determined, by permitted methods, that the user is not a covered
minor, so the host sets it `true` unless that determination says otherwise. Compose such a file with
`composeWithHost(primitives, composition, { "host.covered_minor": true|false })`; plain `compose()` refuses it, so a missing
attestation is an error rather than a silent no-fire. `validateComposition()` checks a file against the vocabulary (and,
for files using `support`, citations, gating, and null rules). Tests: `../ny-s9051.test.mjs`.

Note: the runtime evaluator (`LocalEvaluator`, the demo) does not load host inputs; `ny-s9051-v1.json` is used through
`compose.mjs` on stored primitives until host attestation is plumbed through the runtime.
