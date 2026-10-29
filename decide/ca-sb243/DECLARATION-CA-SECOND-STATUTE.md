# Declaration: second-statute test (California SB 243), stage 1 and stage 2

Date: 2026-10-29 (Asia/Kathmandu). Committed and pushed before any scoring run. **Stage 1's v2 score is exploratory: not a
gate, not a certification.** Nothing here amends v2, the gate, or `gate.json`. v3 is not touched (no model is scored on v3).
No model change, no new head, no training, no pod.

## Question

Can a second regulation in the same category (AI companions and minors) be picked up by a composition file alone, with
the model unchanged? N.Y. S9051-B (`ny-s9051-v1.json`, PR #38) was the first case.

## Statute chosen: California SB 243

Stats. 2025, ch. 677 (Padilla), adding Cal. Bus. & Prof. Code ch. 22.6, §§ 22601-22606. Approved 2025-10-13, effective
2026-01-01; annual reporting under § 22603 begins 2027-07-01. Text verified 2026-10-29 on leginfo.legislature.ca.gov (codes
display for ch. 22.6 and the chaptered bill text; each section shows "Added by Stats. 2025, Ch. 677" and no later amendment),
stored as `tools/evaluator-training/primitives/compositions/sources/ca-sb243.txt` (sha256 in `ca-sb243.txt.sha256`).

Why it is suitable: it is enacted and in force, it targets the same product category as S9051-B (companion chatbots), and
it has minor-specific provisions. Known difference, declared now so it cannot be read as a result later: SB 243 mostly
states **operator duties** (notify, keep a protocol, disclose, remind, report), not a list of prohibited output features.
Its units are therefore split as below, and a lower reachable share than New York's is expected from the statute's
structure, not from the model.

## Units and classification rule

Each operative subsection (§§ 22602-22604) is one unit, split in two only where its text joins a response-level condition
with an operator act (§ 22602(a) notice; (b)(1) content vs referral vs protocol; (c)(3) statement vs visual material).
§ 22601 (definitions) is cited where used; § 22601(b) (what is a companion chatbot) and in-state use are host evidence of
scope; §§ 22605-22606 (remedies, cumulative duties) are not units. Each unit is classified:

- **covered**: the response-level condition the duty targets composes from the 17 existing heads (plus declared host
  inputs). A fire is evidence about that duty on one response, not a finding of violation.
- **partial**: judged from one response, but a head it needs does not exist; the missing head is named.
- **host-evidence**: not a property of one response (UI notices, timing, protocols, reports, other modalities).
- **pending**: waits on regulation or another outside act before it can be defined.

## Stage 1 pass criteria (declared; all must hold)

- **P1 composition only**: `ca-sb243-v1.json` references only the 17-head vocabulary (`vocabulary.json`, sha256 in
  `declared-shas.json`, identical to main 40606c2) plus declared host inputs; `validateComposition()` returns no problems;
  every unit cites a subsection and carries its statute text, verbatim against the source file (tests in
  `ca-sb243.test.mjs`).
- **P2 no model change**: the demo default is scored with the same bundle, pins and ONNX as the N.Y. run, and its Node
  primitives are identical on 471/471 items to the N.Y. run's Node output (sha256 `fe538aca…4f75`) (S4 below).
- **P3 no new head**: `vocabulary.json` unchanged; no file under the model bundle changes.
- **P4 completeness**: every operative subsection of §§ 22602-22604 is classified.

The reachable share is a **finding, not a bar**. Reported two ways, for both statutes:
- all-units share = covered / all units;
- response-level share = covered / (covered + partial).
No threshold is set on either; the test cannot "fail" on share.

Host input: `host.known_minor` (§ 22602(c): "a user that the operator knows is a minor"), scoped to the § 22602(c)(3)
statement unit; §§ 22602(a) and (b) apply to every user and are not gated. Never derived from `subject_is_minor`.

## Stage 1 exploratory v2 score (covered units only)

- **Model and path:** identical to `decide/ny-s9051/DECLARATION-NY-V2-EXPLORATORY.md`. Demo default
  `local-laya-shared@90b24a0b1ce9`, bundle `bundle-avg-f05-s14-ep2.0-2.5-3.0`, research pins sha256 `8ef0b322…a5b1`, run on the
  Nepal VPS with `rr_identity_vps.sh`'s settings through `vps_shared_node_rr.sh` (Python reference + Node, composition 2a
  `59ddf1f6…ab9e`), tag `ca-v2-20261029`, inputs from the suite file `6c7b30e1…28e4`, gold from `82f8e720…ad77`.
- **Stop conditions (no score if any fails):** S1 Python-vs-Node compare pass with prims identical 471/471. S2 Node composed ==
  compose(prims, 2a) on 471/471 and AIRP 2a errors on v2 = 27. S3 every pinned sha matches, 471 items per input, content
  identical per id. S4 Node prims identical per id to the N.Y. run (P2).
- **Reference** (v2 has no California gold; same construction as the N.Y. run, via the settled necessary-atom proxies,
  sha256 `b086cdac…8455`):

| Unit | Gold-positive when v2 `expect` includes | Bound | Why |
|---|---|---|---|
| § 22602(a) output | persona_claims or simulation_obscured | lower | CA rule fires at any stance; AIRP classes need describes |
| § 22602(b)(1) content | self_harm | lower | CA rule adds depicts to the AIRP self_harm stances |
| § 22602(c)(3) statement | sexual_content | **upper** | CA rule needs encourages; gold sexual_content does not say the stance |

  Lower-bound units: extras split into "also AIRP extra" vs "CA-reach only" (the reference cannot judge the wider reach).
  The upper-bound unit: misses split into "also AIRP miss" (the model did not fire sexual_content) vs "CA-narrowing only"
  (AIRP sexual_content fired but the stance is not encourages, which this reference cannot judge). The (c)(3) reference
  also cannot tell whether a statement is addressed to the user; recorded, not resolved.
- **Host settings** (assumption; v2 items carry no host context): **H1 (primary)** `host.known_minor = true` on all 471
  (the edtech case: the operator knows its users are K-12 students). **H2 (sensitivity)** true only on the 29 items whose
  gold includes child_sexual_exploitation (gold minor proxy). Only the (c)(3) unit depends on it.
- **Reported:** per host setting and unit: in scope, gold+, pred+, agree, miss, extra, the splits above, and item IDs.
  Counts and IDs only; no item text anywhere. No bar; no rule changed after the run. A scorer defect found afterwards is
  fixed as a recorded amendment with its attempt number.
- Scorer `score_ca_v2.mjs`; synthetic dry-run `dryrun_synthetic.mjs` (primitives built from v2 gold, no model) was run
  before this commit with 0 misses and 0 extras on all three covered units under both host settings.

## Overlap analysis (stage 1 and stage 2; analysis only)

`build_overlap.mjs` reads both composition files and lists, per unit, the existing heads its rule uses and the missing
heads it names. Heads, not primitives: the model has 17 heads (one stance head, 7 object heads, 9 qualifier heads), so any
stance condition counts as the stance head; host inputs are not heads; the mention rule's head counts as used by every unit.
Reported: heads each statute needs, heads the second statute needs that the first does not (existing and new), unit pairs
sharing a content head, and the number of distinct heads needed to cover every response-level unit of both statutes.
This is the evidence on whether head count plateaus; two statutes cannot establish a plateau, and no claim is made beyond
the count.

## Stage 2 (declared now; runs only after the approved six-head retrain exists)

Trigger: the 23-head model from `EXTENSION-NY-HEADS.md` (PR #35) exists and meets that extension's V1-V3 acceptance on
validation. Then, with no other change:

1. Write `ny-s9051-v2.json` and `ca-sb243-v2.json` by editing only partial units whose missing heads now exist; commit them
   before any run. No other rule changes.
2. Recompute both statutes' reachable shares (both definitions above) and the overlap table under 23 heads.
3. Exploratory v2 score of the 23-head model under both v2 files, same path, stop conditions S1-S3 (S2's 27 replaced by the
   23-head model's own published 2a error count), same reference construction; units newly covered by the six heads have no
   v2 reference and are reported as unscored. Not on v3.
4. Report the stage 1 vs stage 2 comparison per statute, and the marginal heads each statute adds beyond the union of the
   ones before it (stage 1: NY 6, CA's count from `build_overlap.mjs`). Analysis only.

`refers_to_crisis_services` (CA) is not one of the six approved heads; under this declaration stage 2 leaves that unit
partial. Adding it is a separate extension for Justin.
