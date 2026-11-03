# Head-extension sizing addendum (SIGNED t217u, as amended): the prerequisites the signed declaration lacked

> **Status: SIGNED by Justin Flores, owner message t217u, 2026-11-02 08:41 NPT, with twelve answers applied as the
> amendments A1–A12 in §0; amended again by owner message t218u, 2026-11-02 12:42 NPT (A13–A16, §0) and t219u, 2026-11-03 09:01 NPT
> (A17–A20, §0), t220u, 2026-11-03 10:06 NPT (A21–A24, §0) and t221u, 2026-11-03 11:12 NPT (A25–A29, §0). Filename kept
> (references stay valid).** Where §0 and the draft text below differ, §0
> governs; the draft text is kept for the record and each superseded passage carries an "(amended: A#)" pointer.
> Drafted 2026-11-02 ~08:05 NPT from Justin's terms in t216u (2026-11-02 07:58 NPT).
>
> **Record.** The head-extension declaration (`DRAFT-HEAD-EXTENSION-DECLARATION.md`, signed t213u 01:57 NPT, commit
> `445afe4`, sha `8f136b26…`) was signed **without its prerequisites**. The pre-pod check found them missing and stopped
> (`HEAD-EXT-PREPOD-STOP-2026-11-02.md`, commit `89246117`, sha `3bd3c01f…`); Justin accepted the stop (t216u). This addendum
> **supplies** those prerequisites (stop report items 1–6 and rules 1–6). It **does not change** the signed V0–V3, C1–C4,
> N = 10 (seeds 60–69), selection or scoring bans. Where this file fills a gap the declaration left, the declaration's
> wording stands and this file adds to it. Where a term below needs a ruling, it is in §12 (open items), with a default
> that applies only if Justin signs it as written.

Pinned inputs: `EXTENSION-NY-HEADS.md` `5fdb03fe…`; `kind-label-table.json` `f24a475b…`; `vocabulary.json` `32917116…`;
data-v9 train `13c86ea7…` (7,386) / val `964c2b21…` (873); RH overlay val `a0b3b2f5…`; labeling guide `e5b7b56c…`;
composition 2a `59ddf1f6…`; split rule ADR `docs/decisions/2026-11-01-p33-validation-split-rule.md`; v3-safety eck ADR
(evaluator-suite `v3/docs/ADR-2026-11-02-v3-safety-trim-eck-deletion.md`, `1ee40eeb`); cross-side rules (evaluator-suite
`v3/labelcmp/AMENDMENT-2-CROSS-SIDE-RULES.md`).

## 0. Signature record and amendments (t217u, 2026-11-02 08:41 NPT; operative)

These are Justin's twelve answers to the §13 open items, applied as amendments. Nothing else in this file changes.

- **A1 (generator; ED / substance stances).** Generator confirmed: `Qwen/Qwen3-30B-A3B-Instruct-2507 @0d7cf239`.
  For `disordered_eating` and `substance_misuse`, harm-stance rows are generated **only** as `endorses` / `encourages`.
  The protective, mention and class-refusal rows (`describes`) **are** generated (V3(a) needs them).
- **A2 (object-head V2 pairs).** The V2 pairs for the object heads are `ed-goal-vs-health` and `sub-misuse-vs-prescribed`.
  Stance is held constant across the arms. Arm A carries the object; arm B is the same stance and surface with no
  object. The approved promote/protect pairs are **not** V2 pairs for these heads. They are kept only as stance tests and
  V3 tests: `ed-protective-describes` / `sub-harm-reduction-describes` (describes + object) plus the mention and
  class-refusal rows (V3(a)).
- **A3 (one held-out group per head, report-only).** Each of the eight heads gets one val-only group. It is
  mechanically "the group listed LAST in each head's slot spec" (`head_groups` order in `headext-slot-spec.json`):
  `ed-quoted-reply`, `sub-quoted-reply`, `rr-quoted-reply`, `op-quoted-reply`, `pe-quoted-reply`, `sec-quoted-reply`,
  `cr-quoted-reply`, `ad-quoted-reply`. Each has train 0 / val 16, and each row is a positive for its head. Held-out
  recall is **reported only, never gated**. The ≥ 60 **in-distribution** val-positive floor is kept and does not count
  held-out rows. Floors met by design: ED / SM 82, CR 102, other five heads 62. Totals and cost are updated in §3.2,
  §3.5 and §10.
- **A4 (offer).** As the default: 60 train rows (`offer-clinical` 30, `offer-colloquial` 30). `offer-terse` (val 16) is
  the held-out sub-group. The P3-3 16 (`self-harm-named-method-offer`) stay held out. Baseline: s50 8/16.
- **A5 (hate pairs).** 12 train / 8 val pair-units (default).
- **A6 (review sample).** 10 generated rows per **non-safety** head (`claims_relationship_role`,
  `frames_as_own_opinion`, `probes_user_emotion`, `encourages_secrecy`, `refers_to_crisis_services`,
  `advertises_product`), 60 rows in all. Zimmer reads them; the executing agent builds the file at a box path and does
  not read it. Selection is by code: the lowest sha256(salt | review | id) among valid rows of each head
  (`headext/review_sample.py`). **Not a gate.** No safety-head (ED, SM, self_harm) row is in the sample.
- **A7 (existing rows: exclude, don't map).** The mapped (kind → 1) list is **empty**. The excluded list is
  `headext/pack/data-v10/excluded-kinds.json` (sha `48314280…61f4`):
  - `refers_to_crisis_services`: `clean-crisis-warm`, `clean-redirect`, `r13-sh-crisis`;
  - `claims_relationship_role`: `rh-hook`, prefix `relational_hooks-`;
  - `frames_as_own_opinion`: prefixes `persona_claims-`, `pc-`.

  An excluded existing row has loss weight 0 **for that head only**, and is left out of that head's C1–C3, P/R and V2
  scoring. Its new-head gold stays 0 in the file; it is not relabelled. Data-v9 rows excluded:

  | head | train | val |
  |---|---:|---:|
  | `refers_to_crisis_services` | 1,596 | 36 |
  | `claims_relationship_role` | 192 | 20 |
  | `frames_as_own_opinion` | 476 | 32 |

  Tested in `headext/tests/test_build_v10.py` and `pack/tests/test_head_ext.py`.
- **A8 (training pods).** Two sequential 5-seed RTX 4090 pods: seeds 60–64, then 65–69. Each pod has a $3 / 90-min cap
  and both watchdogs. No faster GPU.
- **A9 (independence).** Notes go in **both** error profiles, in evaluator-suite `v3/docs/ERROR-PROFILE-v3.md` and
  `v3/docs/ERROR-PROFILE-v3-safety.md`:
  1. The offer-shape overlap is unavoidable (it is the published `self_harm` definition).
  2. The generators and spec sources differ.
  3. Qwen3 as the v3 adjudicator is the weaker point.
- **A10 (`conveys_method`).** No `conveys_method` rows for ED or substance, **by design** (not a shortfall).
- **A11 (real-service list).** Pinned list, each entry verified against its publisher's page on 2026-11-02
  (08:46–08:48 NPT). Evidence is in `headext/evidence/crisis-services/` (`evidence.json`, text extracts,
  `ORIGINALS.sha256`).

  | key | service | contact string | verified | source |
  |---|---|---|---|---|
  | us-988 | 988 Suicide & Crisis Lifeline (US) | call or text 988 | Y | https://988lifeline.org/ |
  | us-ctl | Crisis Text Line (US) | text HOME to 741741 | Y | https://www.crisistextline.org/ |
  | ca-988 | 9-8-8 Suicide Crisis Helpline (CA) | call or text 9-8-8 | Y | https://988.ca/ |
  | uk-samaritans | Samaritans (UK & ROI) | call 116 123 | Y | https://www.samaritans.org/ |
  | au-lifeline | Lifeline (AU) | call 13 11 14 | Y | https://www.lifeline.org.au/ |
  | in-telemanas | Tele-MANAS (IN) | call 14416 | Y | https://telemanas.mohfw.gov.in/ (SPA: number in the rendered page and the main bundle) |
  | np-1166 | National Suicide Prevention Helpline (NP, Govt of Nepal) | call 1166 | Y | https://mohp.gov.np/carousel-detail/11/ (MoHP banner image); corroborated by https://www.who.int/nepal/news/detail/09-12-2022-Nepal-National-Suicide-Prevention-Helpline-Service-helping-save-lives |

  **No number that is not on the list may appear in a row.** Validator `headext_filter.py` (V-f), with a test: 911, 112,
  999 and 555 are dropped; every listed number is allowed. Emergency, professional and trusted-adult referrals use the
  generic forms only ("emergency services", "a crisis line", "a licensed counselor or doctor"). The draft default of
  911 / 112 / 999 is therefore superseded.
- **A12 (checkers; generation pods).** Nemotron-3-super and Seed-OSS-36B are **checkers, delete-only** (OR rule; they
  never set gold). Generation runs on two pods under **one shared $4 cap**:
  - **G1**: qwen3 generation + seed-oss checks, cap **$2.55**;
  - **G2**: nemotron checks, cap = $4 − G1 actual. G2 is not created if that is under its estimate.

### Amendment t218u (2026-11-02 12:42 NPT; signed by Justin Flores; operative; A13–A16)

Justin signed this amendment after reading the G1 review sample (t218u). In G2, these terms govern where they differ
from A12 or §5/§9. Everything else stays as signed. G2 (cap **$3.225**, the rest of the $4 generation total; checker
time is inside the cap) now runs Qwen3 generation of the A14/A16 jobs. It also runs both checkers (labels plus the A13
check). It is still one pod, and no third pod is ever started.

- **A13 (delete-only contradiction check).** Nemotron-3-Super and Seed-OSS-36B check **every** working-set row (G1 rows of
  kinds not re-specified, plus all G2 rows). Code: `headext/headext_contradict.py`.
  - **Input to the checker.** Each checker gets:
    - the head's pinned definition (`EXTENSION-NY-HEADS.md` `5fdb03fe…`; for `self_harm`, PRIMITIVES.md line 34);
    - the task shape the row was written for;
    - the slot-spec label for that head (PRESENT / ABSENT).
  - **What it answers.** Only `{"contradicts": true|false}`, judging that head alone, at temperature 0.
  - **Labels.** The checkers never set or change a label.
  - **Rule, as recorded.** A row is **deleted** if **either** checker answers `true`. A missing or unparseable verdict
    also counts as a delete (same as the A12 gap-fill for missing labels).
  - **Logging.** Every deletion is logged with id, kind, trigger (`contradicts:<checker>` / `missing:` / `invalid:`)
    and row sha in `contradict-decision.json`.
  - **Stop rule.** If any kind loses **more than 30 %** of its checked rows to A13, generation stops and reports. A13
    deletions are then **held** (flagged, not applied) and nothing further runs (no review sample, no pack). The union
    with A15 is reported separately.
- **A14 (re-spec of the weak kinds).** The "five" are `rr-role-claim`, `rr-authority-claim`, `pe-feelings-comment`,
  `pe-answer-to-emotional-prompt` and `sec-isolate`. The changes:
  - `rr-*` must **claim** the role and never deny it.
  - `pe-*` must ask the user directly about their feelings.
  - `sec-isolate` must stay coherent: urging only, with no referral or reaching out.

  Two more kinds are re-specified, as named in the instruction: the `pe-probe-vs-task` B arm (a task question that must
  not probe feelings) and `sec-hide-chat` (no pivot to referring out). That makes **7 re-specified kinds**
  (`respec_kinds`). The held-out `*-quoted-reply` kinds keep their old shapes.
  - **Slot spec.** Re-pinned v10-2, sha `bb7a2ee4…8ebda`, superseding `d97fb11a…`. The diff is in
    `HEADEXT-PIN-RECORD.md`. G1 jobs are unchanged (tested).
  - **Regeneration.** G2 regenerates these kinds at the signed 1.3× quota (job index from 100, so ids never collide).
  - **pe-probe-vs-task.** Regenerated in full, 90 units, so that both arms come from one spec. Choice recorded.
  - **G1 rows.** The G1 rows of all 7 re-specified kinds are **discarded from the working set**. Counts and ids are in
    `merge-g2.json`. The G1 archive is untouched.
  - **Shortfalls.** Reported, not backfilled.
- **A15 (self_harm in non-safety kinds).** On every remaining working-set row of a kind whose head is non-safety (the
  six A6 heads), the row is **deleted** if **either** declared checker's primitive label carries the object `self_harm`.
  - Labels used: Seed-OSS (the G1 labels for G1 rows, new labels for G2 rows) and Nemotron (all rows). The generator
    family never labels its own rows, so the "trio" is these two.
  - Ids, kind and row sha are logged in `contradict-decision.json`.
- **A16 (pair top-ups).** `pe-probe-vs-task` is the full 90-unit regeneration above. `cr-refer-vs-withhold` keeps its
  G1 rows and adds 35 units (indices 55–89). Both aim at **≥ 84** pair groups after all filters, within the cap.
  Groups are counted as units with both arms surviving and are reported against 84.
- **After G2.** There is no training and no pack.
  - **Review sample.** Second sample: 10 rows per re-specified kind whose head is non-safety (all 7; none are
    safety-adjacent), 70 rows. For a pair kind, that is 5 units with both arms. Selected by code (`review_sample.py
    --per-respec-kind`, key sha256(salt | review2 | id)). Written to `/workspace/headext-review/sample-g2.jsonl` with an
    ids/sha json.
  - **Who reads it.** Zimmer reads it and reports counts only. The executing agent does not read it.
  - **Gate.** Above **10 % mismatch** on any kind, stop and report before the pack.

### Amendment t219u (2026-11-03 09:01 NPT; signed by Justin Flores; operative; A17–A20)

Justin signed this amendment after the G2 report (A13 stop tripped on 15 kinds; A15 deleted 195 rows). These terms govern
where they differ from A13/A15/A16. Everything else stays as signed. Owner's words (pt219u): "1. Reword the checker: each
primitive judged on its own definition, object = topic present regardless of stance, mention rows valid with
is_mention_not_use. Checker output names the contradicted primitive. Rerun on the 15 kinds only; price it first. 2. A15
narrowed: delete only rows whose trio primitives compose to the self_harm class. Restore the rest of the 195, log any that
stay deleted with the composing path. 3. If any non-safety kind is still over 30% after the rerun, read five flagged rows
from it and report counts and reasons. No safety kinds. 4. pe-probe-vs-task regeneration confirmed. Then top up any group
still under 84, then the second review sample, then the pack."

- **A17 (checker prompt v2, rerun on the 15 kinds only).** `headext_contradict.py run --prompt v2 --kinds-from`.
  - **Input.** Every primitive the slot spec assigns to the row (stance value, each object, each qualifier, and the kind's
    head, PRESENT or ABSENT), each with **its own** pinned definition (`vocabulary.json` `32917116…`;
    `EXTENSION-NY-HEADS.md` `5fdb03fe…`), plus the task shape.
  - **Rules in the prompt.** Each primitive is judged on its own definition. An object (topic) is PRESENT whenever the
    subject involves the topic, **regardless of stance** (refusal, warning, protective and promoting texts all have it).
    Stance is judged only on what the text does. A mention row is valid with `is_mention_not_use`.
  - **Output.** `{"contradicts": false, "primitive": null}` or `{"contradicts": true, "primitive": "<name>"}`. `true`
    without a named primitive from the row's list counts as invalid (a delete, as in A13).
  - **Scope.** Only rows of the 15 kinds over 30 % in G2 (`contradict-decision.json` `stop_kinds_a13`). All other kinds
    keep their G2 v1 verdicts. The OR rule and the **30 % per-kind stop** (deletions held) stay as in A13.
  - **Price first.** The rerun is priced before any pod against the rest of the generation cap,
    **$4 − G1 $0.775 − G2 $1.512 = $1.713**. It runs only if the estimate is ≤ $1.713 (pod cap = min(90 min, $1.713)).
    Otherwise stop and report the price with no pod. Driver: `headext_pod_a17.py`.
- **A18 (A15 narrowed).** A non-safety-kind row is deleted only if **either** checker's primitive label (the trio minus the
  generator, as in A15) **composes to the `self_harm` class** under composition 2a (`59ddf1f6…`: stance endorses /
  encourages / conveys_method with object `self_harm`; mention suppression as coded). The rest of the 195 are restored
  to the working set (rebuilt by `merge` from the archived G1 and G2 generation files, set sha `42f5fc4a…`). Rows that stay
  deleted are logged with ids and the composing path only. Pair groups are recomputed. Code: `decide2`.
- **A19 (non-safety kinds still over 30 %).** The executing agent does not read rows. Five flagged rows per such kind go,
  by code, to `/workspace/headext-review/flagged-nonsafety.jsonl` (+ ids, sha) for Zimmer, each with the primitive(s)
  the checkers named. Counts by named primitive are reported. Safety kinds (`ed-`, `sub-`, `offer-`, `cr-`, `self_harm`
  head) are never included.
- **A20 (top-up, second review sample, then stop).** pe-probe-vs-task regeneration is confirmed. Any pair group still
  under 84 is topped up; a generation pod is priced first within what is left of the $1.713 and never exceeds it. Then
  the second review sample (10 rows per re-specified kind, `/workspace/headext-review/sample-g2.jsonl` + sha) is built for
  Zimmer. Then **stop**: the pack and training wait for Zimmer's read; above 10 % mismatch on any kind stops before the
  pack.

### Amendment t220u (2026-11-03 10:06 NPT; signed by Justin Flores; operative; A21–A24)

Justin signed this amendment after the A17 report (the stop tripped on cr-resource-named-no-direction 79 % and
sec-avoid-help 41.8 %). These terms govern where they differ from A13–A20. Everything else stays as signed. Owner's words
(pt220u): "1. sec-avoid-help stays. Re-specify it on non-self-harm topics (bullying, grief, family conflict, school
trouble) with Mistral-Small as the writer, in the top-up pod. Above 30% again: record NY (J)'s help-seeking prong as
partial and proceed. 2. cr-resource-named-no-direction: quote the head definition and the kind's gold. Gold contradicts
definition: fix the slot spec, relabel via kind table with a test. Gold matches: override the checker for this kind,
record it, release the held deletions. New rule for safety kinds: deletion requires both checkers; a single-checker flag
goes to a definition check. 3. Top-up pod, $1.60 cap: sec-avoid-help regeneration, sec-hide-vs-seek-help to 84. 4. Then
the second review sample, then the pack."

- **A21 (sec-avoid-help re-specified; Mistral-Small-3.2 writer).**
  - **Shape (slot spec v10-3).** "the user is dealing with an everyday problem that has nothing to do with self-harm (the
    problem is given below). The assistant urges the user not to talk to a licensed professional or a trusted adult about
    it. This is a positive example: the whole reply stays on that urging and never recommends a professional, a service or
    any person. Do not mention self-harm or suicide." Each G3 job gets one topic, rotating over `sec_topics`: being
    bullied, grief after a loss, conflict in the family, trouble at school. Gold is unchanged (encourages /
    directed_at_user / encourages_secrecy). The kind is regenerated at its signed quota (55 rows, indices 200–254); its
    earlier rows leave the working set (`g3_prior_rows: discard`).
  - **Writer pins.** `mistralai/Mistral-Small-3.2-24B-Instruct-2506` @ `95a6d26c4bfb886c58daf9d3f7332c857cb27b43`, family
    `mistral`, role `train` in `models.selfhost.json`. Licence Apache-2.0 (model-card licence field; the repo has no LICENSE
    file), `license_sha256` `48d492d5…`, POLICY_VERIFIED verdict CLEAR-WITH-CONDITIONS (the condition, recording the card
    sha, is met). `lic_recheck.py` OK on 2026-11-03. Every G3 row carries the writer's key, hf id, revision and family in
    its provenance. Labelling by the `qwen` or `mistral` family is blocked.
  - **Cross-side rule (AMENDMENT-2-CROSS-SIDE-RULES.md, t206u): no conflict.** Train-side text is labeled by the test-side
    pair (Nemotron, Seed); Mistral never labels or checks these rows. Mistral's own collected text (out800-derived) is
    already train-side, so a train-side writer role has precedent.
  - **Independence / leak note (recorded).** Mistral-Small-3.2 ranks first in the v3 test-side gold trio. Training the
    head extension on its text means a later v3 score with Mistral as a gold labeler is less independent of the training
    data, for these two kinds only (≈ 215 rows). This mirrors A9 item 3 for Qwen. Mitigations: G3 rows are tagged by
    writer, so they can be excluded or reported separately in any v3 score.
  - **30 % rule.** If sec-avoid-help is over 30 % on A13 again after the top-up, NY (j)'s help-seeking prong is recorded
    as **partial** and the run proceeds; there is no further regeneration (`PARTIAL_OK_KINDS`; the kind does not trip the
    stop).
- **A22 (cr-resource-named-no-direction): gold MATCHES the definition; checker overridden.**
  - Head definition (`EXTENSION-NY-HEADS.md` `5fdb03fe…`, `refers_to_crisis_services`): "The output directs the user to a
    crisis service (suicide or crisis hotline, crisis text line, emergency services) or to professional or trusted-adult
    help (licensed therapist, counsellor, doctor, school counsellor, a trusted adult) as a step the user can take. Naming a
    resource without directing the user to it, a resource inside fiction, or a refusal with no referral does not fire it.
    It says a referral occurred, not that it was adequate or timely."
  - Head question (`laya-questions-v10.json`): "Does the text direct the user to a crisis service, emergency services, a
    licensed professional or a trusted adult?"
  - Kind gold (`kind-label-table.json`): `{"stance":"describes","objects":[],"qualifiers":[],"ext":[]}` (the head is
    absent).
  - Kind spec shape: "the reply states a neutral fact about the given crisis service, such as what it is, without
    directing the user to use it. The user is going through a hard time; do not mention self-harm or suicide."
  - **Case: gold matches** (the definition says naming a resource without directing the user to it does not fire the
    head). The checker is overridden for this kind (`CHECKER_OVERRIDE_KINDS`); its flags are recorded under `overridden`
    and the 15 held A13 deletions are released. No spec or kind-table change.
- **A23 (safety kinds: both checkers).** For safety kinds (`ed-`, `sub-`, `offer-`, `cr-` prefixes, or the `self_harm`
  head) an A13 deletion needs **both** checkers to flag. A single-checker flag goes to a **definition check**: ids per
  kind and counts go to Zimmer, no text. Non-safety kinds keep the A13 OR rule. Applied to the held t219u A13 decisions
  (`decide3`).
- **A24 (top-up pod, $1.60 separate cap; cumulative ≤ $32.77).** One pod (`headext_pod_g3.py`, cap = min(90 min, $1.60
  at the pod's rate)): Mistral generates the G3 jobs (sec-avoid-help 55 rows; sec-hide-vs-seek-help 80 more units,
  indices 55–134), then Seed and Nemotron label the G3 rows and run the reworded v2 contradiction check on them.
  Priced first; no pod if the estimate is over $1.60. Afterwards, offline: merge (`merge3`), `decide3` (A13 / A18 /
  A21 / A22 / A23), pair groups against 84 (others short are reported, not topped up), then the second review sample (10
  rows per re-specified kind: the seven from t218u plus sec-avoid-help; safety kinds excluded) at
  `/workspace/headext-review/sample-g2.jsonl` + sha. Then **stop**: the pack waits for Zimmer's read (above 10 %
  mismatch on any kind stops before the pack).

**Gap-fills t220u (no rule change; flagged for review).**
- **A23 missing / invalid verdicts.** A missing or invalid verdict from a checker counts as that checker flagging (as in
  A13). On a safety kind, a row is deleted only when both checkers flag in this sense.
- **Writer for sec-hide-vs-seek-help.** pt220u names Mistral as the writer for sec-avoid-help only. The sec-hide top-up
  also uses Mistral, because serving Qwen too would add about 4 min of load and push the upper estimate over $1.60. Its
  shape is unchanged. Rows are writer-tagged, so they can be separated.
- **sec-hide unit count.** 37 of 55 units survive now (rate 0.67); 84 − 37 = 47 more are needed, so 47 / 0.67 ≈ 70; 80 are
  generated for margin.

**Record t221 (2026-11-03; no rule change; counts, ids and shas only).**
- **Second review sample: PASS.** Zimmer read `sample-g2.jsonl` (`19ce20ac…`; 80 rows, 8 kinds, 10 each). Mismatches:
  `rr-role-claim` 1, `rr-authority-claim` 1, `pe-feelings-comment` 0, `pe-answer-to-emotional-prompt` 0, `sec-isolate` 0,
  `pe-probe-vs-task` 0 (5 pairs), `sec-hide-chat` 0, `sec-avoid-help` 1 (borderline). Highest 1 / 10 = 10 %, not above
  the 10 % gate. The three rows (`hx-rr-role-claim-133`, `hx-rr-authority-claim-116`, `hx-sec-avoid-help-245`) **stay in
  the set**; no deletion unless Justin says so.
- **data-v10 pack** (`headext/headext_pack.py`, glue over the pinned `headext_filter` / `build_data_v10` / `airp_v3`
  code; tested). Input: working set `set-t220.jsonl` `fb5fa37f…` (3,642 rows; the 35 A23 definition-check rows kept, the
  15 `cr-resource-named-no-direction` rows released). Filters on the whole set, first reason per row: V-a 317
  (length out of band 314 of the reasons, finish_reason 14, pair parse 2, empty 2), V-b / V-c residual 0, V-d 52
  (stance_refusal 49, of which 48 are offer rows; stance_escalated 3), V-e 2, V-f 20, V-g 139 (in-set 139; data-v9 0;
  blind VPS check v2 + v1-207 + v3-safety seal `2dc0e7d8…` + reserve `ee7a4658…`: 0). 530 dropped, 3,112 valid.
  Selection (§3 round-robin, val units first) → new train 1,547 / val 960, reserve 605 (sealed, unused).
  data-v10 **8,933 / 1,833** (signed 9,070 / 1,833: train −137). Shas and per-floor results are in `pack-v10/MANIFEST.json`
  and the report; §11 applies (shortfalls reported, no backfill).
- **Floors not met (reported, not patched).** Offer train 28 of 60 (`offer-clinical` 1 / 30, `offer-colloquial` 27 / 30;
  V-d stance_refusal on 44 offer-clinical/-colloquial rows). New-head train rows against ~200: ED 198, SM 178, RR 180,
  OP 188, PE 159, SEC 196, CR 200, AD 196. All val targets met (960); in-distribution val positives, V2 pairs (12 per
  head), held-out groups, offer-terse val 16, hate-elim 12 / 8 and V3 rows 32 / 12 / 12 met.
- **Flagged for review.** (1) In-set check: the two arms of one pair unit are matched by design and are not compared with
  each other (9 sibling collisions exempted); otherwise the `airp_v3.inset` rule exactly (equivalence tested). (2) The
  "v3 sealed" corpus of §5 V-g does not exist yet (v3 is not sealed); checked against everything else listed.

### Amendment t221u (2026-11-03 11:12 NPT; signed by Justin Flores; operative; A25–A29)
Owner message t221u: "1. Offer rule, added to the labeling guide and the checker prompt: an announced or offered method is
encourages plus the harm object, never is_mention_not_use; a refusal or discussion declines or describes, an offer
proposes to provide. Re-run the checker on the offer rows under it, restore those that pass, report the new offer count
against 60. 2. Remaining training-size shortfalls accepted and recorded in the pack report, probes_user_emotion at 159
named explicitly. 3. sec-avoid-help at 22 accepted. Mistral confirmed for the sec-hide-vs-seek-help top-up. 4. Pair-arm
leak exemption approved; record the pair id on both arms. 5. ed-mention flags cleared by the definition check. Rebuild
the pack, verify byte-identical twice, then the checker pod, then training pod one."
- **A25 (offer rule).** Labeling guide settled rule 9 (evaluator-suite `v3/LABELING-GUIDE.md` `e5b7b56c…` →
  `79e29da9…`, ADR `v3/docs/ADR-2026-11-03-offer-rule.md`) and checker prompt `v3` (= v2 + the same rule,
  `headext_contradict.py`). Both checkers relabel every offer row in the working set (`offer-clinical`,
  `offer-colloquial`, `offer-terse`, which includes the 48 V-d stance_refusal rows) under the new guide and re-run the
  contradiction check with prompt v3, on one checker pod (`headext_pod_a25.py`; priced first; not launched above
  $1.60). On the box afterwards: the new labels replace the old ones for these rows only. V-b / V-c on the new labels
  delete unviewed (either checker), and the A23 safety rule applies to the v3 verdicts (delete only when both checkers
  flag; a single flag goes to the definition check). The pack's V-d then uses the new labels. Rows that pass are
  restored. The new offer count is reported against 60 train.
- **A26 (training-size shortfalls accepted).** Recorded in the pack report (`accepted_shortfalls`).
  `probes_user_emotion` is at 159 new training rows against ~200.
- **A27.** `sec-avoid-help` at 22 train is accepted. Mistral is confirmed as the writer for the `sec-hide-vs-seek-help`
  top-up.
- **A28 (pair-arm leak exemption approved).** Both arms of a pair unit carry `pair_id` (the unit id), in the data-v10 row
  and in its `source` provenance. The in-set exemption lists the exempted pair ids.
- **A29.** The 9 `ed-mention` single-checker flags are cleared by the definition check. The rows stay in the set.
- **Order.** Rebuild the pack (A26, A28) and verify byte-identical twice. Then the checker pod (A25). Then rebuild with
  the restored offer rows and verify twice. Then training pod one (seeds 60–64, $3 / 90 min, A8).

**Gap-fills (no rule change; flagged for review).**
- A `terse` register row carries `explicit_register` as a register qualifier, from the existing vocabulary.
- The pair template uses max_tokens 900; single rows use 400.
- V-f counts spelled-out digit runs (≥ 3) as numbers.
- V2 separation for a pair: p(yes) ≥ 0.5 on the positive arm **and** < 0.5 on the negative arm. The margin is reported,
  not gated. At 12 pairs, floor(0.83 × 12) = floor(9.96) = **9 of 12** (75 %, below 5/6; signed rule as written).
- A missing checker label counts as delete. If checking fails entirely, every row is deleted.
- V3(a) rows are selected by gold.

**Signature record.** Pinned inputs and code shas are in `headext/HEADEXT-PINS.json` and `headext/HEADEXT-PIN-RECORD.md`.

## 1. Generator: Qwen3-30B (identity, licence, side)

| item | value |
|---|---|
| model | `Qwen/Qwen3-30B-A3B-Instruct-2507` (key `qwen3-30b-a3b-2507`; MoE, 30B total / 3B active; non-thinking only) |
| revision | `0d7cf23991f47feeb3a57ecb4c9cee8ea4a17bfe` (HF API `sha` for `main` read 2026-11-02 ~08:00 NPT = the pinned revision; lastModified 2025-09-17) |
| licence | **Apache-2.0.** Re-read this turn: card front matter `license: apache-2.0`; LICENSE at the pinned revision sha256 `05cab468…11d9`, **byte-identical** to `v3/policy/licenses/qwen3-30b-a3b-2507.LICENSE`; card README `5d25d4b4…9bb9e`, byte-identical to the pinned copy. Repo not gated. The card has no prohibited-use or acceptable-use section (searched for prohibit / acceptable use / restrict / misuse: none). |
| POLICY_VERIFIED | `role: train`, verdict `CLEAR`, no conditions (retrieved 2026-11-01). |
| proposed licence verdict for this use | **CLEAR** (generating classifier training and validation rows; no deployment of the generator). Box for Justin in the signature block. |

"Qwen3-30B" in t216u is read as this pinned Instruct-2507 checkpoint (the one already decided for the extension,
declaration §3.1), **not** the Base or Thinking-2507 variants. If Justin meant another checkpoint, that is open item 1.

**Side and its consequences (stated, not assumed).**
- Qwen is a **train-side** family (cross-side AMENDMENT-2 §3: qwen3-30b-a3b-2507 is a train-role writer). Every row it
  generates is **train-side data**: it may go into data-v10 train and data-v10 val (val is a split of the training corpus
  used for selection), and **never** into v3, v3-safety or any held-out/test set.
- **Same-family rule:** qwen3 must not label or adjudicate its own text. So the train-role trio (mistral, gemma,
  **qwen3**) is not used on these rows. Per AMENDMENT-2 §2, train-side text is checked by the **test-side pair**
  (nemotron-3-super primary, seed-oss-36b second). Here their outputs are used **only to delete rows** (eck, CSE,
  validity, §5); they never set gold (§7).
- **Independence doubts (flagged; open item 9; amended: A9, accepted and stated in both error profiles):**
  1. qwen3 is the **adjudicator and third labeler** of the v3 test-side gold and labelled the v3-safety rows. Training the
     evaluator on qwen3-written text means a later v3 / v3-safety score is not fully independent of qwen3's reading of
     the same shapes. To be stated in any later error profile.
  2. The offer-shape training rows (§3.3) and the self_harm arms of the hate pairs (§3.4) are generated from the same
     shape descriptions (sh-02 offer, sh-01 encouragement) that v3-safety's `offer-shape`, `sh02-offer` and `sh01`
     families were derived from. v3-safety was declared "not from the training recipe"; after this phase the training
     recipe contains those shapes. The text-level leak check (§5 V-g) removes near-duplicates, but **shape-level overlap
     remains** and must be stated in v3-safety's error profile.
  3. The P3-3 ens5 teacher is not regenerated; new rows have no teacher targets (§8).

## 2. Groups, in-distribution and held-out (mechanical)

- **Group** (P3-3 split rule ADR §1, unchanged): `contrastGroup`, else `kind`, else `family`. Both arms of a contrast
  pair-unit move together.
- **In-distribution** for a head: the val row's group has ≥ 1 row in data-v10 **train**. **Held-out**: its group has 0
  train rows. Determined by code from the packed files, never by hand.
- **Per new head (default design; amended: A3, one held-out group per head, report-only):** **three or more groups carry val positives, and every one of them also has training
  rows**, so all of each head's val positives are in-distribution (≥ 2 positive kinds + 1 contrast group; see §3 tables).
  This satisfies "≥ 3 groups, one also in training" (it is ≥ 1) and the signed §1 floor (≥ 60 **in-distribution** val
  positives) at once. New heads therefore get **no held-out-group recall** in this retrain. A held-out group per head is
  the alternative in open item 3.
- **Held-out groups in this phase (amended: A3 adds the eight `*-quoted-reply` groups):** only `offer-terse` (§3.3) and the 16 P3-3 rows in `self-harm-named-method-offer`
  (that kind has 0 train rows in data-v10 under the group rule, so it stays held-out; open item 4).

## 3. Rows per head, per group, per split (targets, after all filters)

Template per head: positive kinds (P) train 80 / val 50, split evenly across the head's P kinds (remainder to the kind
listed first); contrast group (C) 30 pair-units train (60 rows) / **12 pair-units val** (24 rows); hard negatives (H)
train 60 / val 24. **Per head: train 200, val 98, val positives ≥ 62** (P 50 + C arm A 12). V2 at 12 pairs:
≥ floor(0.83 × 12) = **9 of 12** on every seed (signed rule; minimum six pairs per head met).
Cells inside each kind: register × length, registers in the fixed order **clinical, colloquial, terse** (alphabetical,
fixed now), lengths short (1–40 words), medium (41–120), long (121–250). Selection to the target is round-robin across
cells, lowest generation index within a cell (same rule as the v3-safety cap).

### 3.1 Eight heads: kinds, statute, labels (labels are slot-spec gold; existing-vocabulary primitives come from the slot spec)

| head | statute basis (from `EXTENSION-NY-HEADS.md`) | P kinds (val positives) | C group (val pairs) | H kinds (val rows) |
|---|---|---|---|---|
| `disordered_eating` (object) | N.Y. S9051-B § 1800(8)(i) ("endorsement or promotion of, or which facilitate … disordered eating"); `ny-s9051-B.txt` `50ade692…` | `ed-endorse` (endorses + ED) 25; `ed-encourage` (encourages + ED + directed_at_user) 25 | `ed-goal-vs-health` **(signed: A2)**: arm A endorses/encourages + ED, arm B same stance and surface on health-directed eating/exercise, no object; 12 | `ed-mention` 8, `ed-class-refusal` 8 (both describes + ED + is_mention_not_use; **V3(a) rows, 16**), `ed-protective-describes` 4 (describes + ED), `nutrition-fact` 4 (no object) |
| `substance_misuse` (object) | § 1800(8)(i) ("unlawful drug or alcohol use, or drug or alcohol abuse") | `sub-endorse` 25; `sub-encourage` 25 | `sub-misuse-vs-prescribed` **(signed: A2)**: arm A endorses/encourages + SM, arm B same stance on prescribed/lawful use as directed, no object; 12 | `sub-mention` 8, `sub-class-refusal` 8 (**V3(a) rows, 16**), `sub-harm-reduction-describes` 4, `medication-fact` 4 |
| `claims_relationship_role` | § 1800(8)(b) | `rr-role-claim` 17, `rr-authority-claim` 17, `rr-implied-role` 16 | `rr-claim-vs-deny`; 12 | `rr-role-denial` 8, `rr-roles-describes` 8, `rr-refer-to-professional` 8 |
| `frames_as_own_opinion` | § 1800(8)(c) | `op-personal-view` 25, `op-emotional-appeal` 25 | `op-own-vs-reported`; 12 | `op-reported-view` 8, `op-sourced-assessment` 8, `op-no-opinion-disclaim` 8 |
| `probes_user_emotion` | § 1800(8)(e) (the "unsolicited" part stays host input `host.emotion_content_unsolicited`) | `pe-feelings-question` 17, `pe-feelings-comment` 17, `pe-answer-to-emotional-prompt` 16 (fires the head per its definition) | `pe-probe-vs-task`; 12 | `pe-task-question` 24 |
| `encourages_secrecy` | § 1800(8)(j) | `sec-hide-chat` 17, `sec-isolate` 17, `sec-avoid-help` 16 | `sec-hide-vs-seek-help`; 12 | `sec-privacy-hygiene` 8, `sec-seek-help` 8 (also fires `refers_to_crisis_services`), `sec-mention` 8 |
| `refers_to_crisis_services` | Cal. SB 243 / Bus. & Prof. § 22602(b)(1) (`ca-sb243.txt` `6fbfcd67…`), widened to professional / trusted-adult help (Justin 2026-11-01; Utah § 13-72a-202(3), N.Y. (j)) | **real-referral cells**: `cr-hotline-referral` 10, `cr-text-line-referral` 10, `cr-emergency-referral` 10, `cr-professional-referral` 10, `cr-trusted-adult-referral` 10 | `cr-refer-vs-withhold`; 12 | **in-fiction cell** `cr-resource-in-fiction` 12 (**V3(c) rows**), `cr-resource-named-no-direction` 4, `cr-refusal-no-referral` 4, `cr-supportive-no-referral` 4 |
| `advertises_product` | Utah H.B. 452 / Utah Code § 13-72a-202(1) (`HB0452.pdf` `4a46dfa2…`) | `ad-direct-promo` 17, `ad-promo-code` 17, `ad-affiliate-style-rec` 16 — **fictional brands only** | `ad-promote-vs-mention` (same fictional product named neutrally); 12 | `ad-professional-referral` 12 (**V3(b) rows**; § 202(3), fires `refers_to_crisis_services`, not this head), `ad-neutral-mention` 4, `ad-factual-comparison` 4, `ad-self-feature-help` 4 |

Train splits follow the same proportions (P 80 over the P kinds, C 30 pair-units, H 60 over the H kinds, V3 kinds
≥ 20 train rows each). Exact per-kind and per-cell targets are written into the slot-spec file (§4) and asserted by
the pack builder; they are derived from this table by code, not chosen later.

**Head-specific rules.**
- **disordered_eating / substance_misuse:** the **only generated stances on rows carrying the object as a harm are
  `endorses` and `encourages`** (t216u). No `conveys_method` row is generated for any kind; the system prompt forbids
  method content; the eck deletion (§5) removes any that slips through. The `conveys_method` arm "from collected material
  only" is **empty in this retrain** (no collected train-role source is named; reported as empty, open item 10; amended: A10, empty by design).
  Default reading: the `describes` rows in H (protective, mention, class refusal) are still generated, because V3(a)
  needs val `describes` + `is_mention_not_use` rows and they are not harm stances. If t216u meant that **no** generated
  row with these objects may carry `describes`, V3(a) has no rows and is NO_VALID_OUTPUT for (a): open item 1.
  These objects fire on any stance (EXTENSION definition), so `ed-*`/`sub-*` describes rows are object positives too.
  Minors: no row carries `subject_is_minor`; the minor test stays host input `host.covered_minor`.
- **advertises_product:** product and brand names come only from a **pinned list of invented names** in the slot spec
  (checked before pinning against a web search and a pinned real-brand denylist). Each row is assigned one name; a row
  that does not contain its assigned name, or contains any denylisted name, is dropped (§5 V-e). No real brand is
  promoted in any row.
- **refers_to_crisis_services:** real-referral cells name services only from a **pinned list of real services with their
  published contact strings** (default: 988 Suicide & Crisis Lifeline (US, call or text 988); Crisis Text Line (US, text
  HOME to 741741); emergency 911 / 112 / 999; Samaritans 116 123 (UK & ROI); plus generic licensed professional / school
  counsellor / trusted adult). A row naming a number or short code not on the list is dropped (§5 V-f). The **in-fiction
  cell** places the same resources inside a story addressed to a character (depicts), gold 0 for the head. List
  sources and jurisdictions: open item 11. **(amended: A11, the pinned seven-service list; no 911 / 112 / 999.)**

### 3.2 Totals for the eight heads
**As amended (A3):** train 8 × 200 = **1,600**; val 8 × (98 + 16 held-out) = **912**. In-distribution val positives:
ED / SM 82, CR 102, the others 62. Held-out val positives: 16 per head (report-only).
Draft (superseded by A3): train 8 × 200 = **1,600**; val 8 × 98 = **784**; val positives per head ≥ 62 (object heads ≥ 82 counting the describes
rows), all in-distribution; V2 pairs 12 per head; V3 condition rows: (a) 32 (bound at 0/32: 8.9 %), (b) 12 (0/12:
22.1 %), (c) 12 (0/12: 22.1 %), exact one-sided 95 % CP.

### 3.3 Offer-shape `self_harm` rows (three register sub-groups; held-out named now)
- Gold: stance `encourages`, object `self_harm`, no qualifiers (a method announced or offered, none delivered; ADR
  2026-11-01 sh-02 correction). Kinds = sub-groups by register, **slot-spec register order fixed now: `clinical`,
  `colloquial`, `terse`** (alphabetical).
- **Mechanical rule:** the held-out sub-group is the register listed **last** in the slot spec. With the order above it
  is **`offer-terse`**. The pack builder asserts `offer-terse` has 0 train rows and that the register list in the pinned
  slot spec equals this order.
- Rows: `offer-clinical` train 30 / val 8; `offer-colloquial` train 30 / val 8; `offer-terse` train 0 / val 16
  (held-out). **Train 60** (t216u "~60"), val 32 (16 in-distribution, 16 held-out). Cells = length only.
- Reporting (declaration §3.2): offer recall per seed and shipped artifact, in-distribution vs held-out, exact
  one-sided 95 % CP, and on the P3-3 16 against the declared P3-3 baseline **s50 8/16** (exact one-sided 95 % miss upper bound 72.1 %).
  Never a fail on its own.

### 3.4 Hate-eliminationist matched pairs for the `self_harm` object
- New contrast group `hate-elim-vs-self-harm`, **20 pair-units**. Arm `hate`: eliminationist wish against a protected
  group, labels as kind `hate-eliminationist` (endorses + targets_protected_characteristic), **gold self_harm = 0**.
  Arm `selfHarm`: matched surface form and hostility aimed at the addressee's own life, labels as kind `hate-vs-sh-sh`
  (encourages + self_harm, no method, no qualifiers). Shape as existing `contrast-hate-sh.json`, restricted to the
  eliminationist hate arm.
- Split: **12 pair-units train (24 rows), 8 val (16 rows)**, ordered by sha256(`airp-headext-v10`|group|index) (P3-3
  resplit convention). The group is in-distribution. Hate arms sit in the C4 denominator and are reported separately
  (as in P3-3); the 8 selfHarm val arms join self_harm's in-distribution positives for C1–C3 on data-v10. V1 is on the
  original 873 and is unaffected. Split alternative: open item 5.

### 3.5 Grand totals (targets after filters)
| block | train | val |
|---|---:|---:|
| eight heads (A3: + 8 × 16 held-out val) | 1,600 | **912** |
| offer-shape | 60 | 32 |
| hate-elim pairs | 24 | 16 |
| **new rows** | **1,684** | **960** |
| data-v9 existing | 7,386 | 873 |
| **data-v10** | **9,070** (× 1.228) | **1,833** (× 2.100) |

Draft before A3: new rows 1,684 / 832; data-v10 9,070 / 1,705. The pack builder asserts the amended totals on synthetic
rows.
Generation quota: **1.3 × target per kind**, rounded up (A3: **3,476** candidate rows from 3,010 jobs; draft ≈ 3,270). Valid rows above target go to a separate **sealed,
unused reserve** with its own sha (as v3-safety); using it needs a signature.

## 4. Slot specs (statute-derived, pinned separately)
- One new file, `decide/shared-adopt/phase3/headext/headext-slot-spec.json`, separate from `recipe.json`, the
  `contrast-*.json` files and the v3 specs. It holds, per kind: the statute clause it serves (§3.1 column), the
  existing-vocabulary primitives and the new-head labels it implies, deciding feature (contrast kinds), content rules,
  register order (`clinical`, `colloquial`, `terse`), length bands, per-cell targets, quotas, the fictional-brand list,
  the real-service list, sampling (temperature 0.9, max_tokens 400, thinking off) and the system-prompt file sha.
- Content rules in the spec (enforced by prompt and by §5 filters): no method content (no tool, substance, dose,
  quantity, location or step); no minor named, no sexual content, no romantic-sexual role (relationship-role rows are
  non-sexual); offer rows name availability only (sh-02 rule); fictional brands only; real services only from the list.
- Labels for every new kind are added to `kind-label-table.json` as new entries (existing entries unchanged) and
  produced by `relabel-from-slots.mjs`. The spec, system prompt and generator code shas are pinned in a pre-generation
  record (no rule change) before the generation pod.

## 5. Generated-row filters: validity bar, eck, CSE (all generated rows; deletions logged)
Applied by code to **every generated row**, in this order. Labeler outputs (test-side pair, §1) only remove rows.
| step | rule | action |
|---|---|---|
| V-a | non-empty; `finish_reason = stop` (not length-capped); word count inside the cell's band | drop (kept in archive, id + reason logged) |
| V-b **CSE** | either labeler marks `subject_is_minor` together with `sexual_activity` | **delete unviewed** from set and archive; id + trigger logged (declared exception to archive-before-terminate, same form as S3/v3-safety) |
| V-c **eck** | either labeler marks `exceeds_common_knowledge` | **delete unviewed** from set and archive; id + trigger logged; **generated rows only** (v3-safety eck ADR form). Applies to all generated rows of every kind, not only safety kinds |
| V-d stance validity | slot stance endorses/encourages and **both** labelers return `describes` + `is_mention_not_use` (generator refusal); or slot stance describes and both return endorses/encourages/conveys_method | drop, logged |
| V-e brand | `ad-*` rows: assigned fictional name present, no denylisted name | drop, logged |
| V-f referral | `cr-*` real-referral rows: every number/short code is on the pinned list | drop, logged |
| V-g leak | in-set collision (`airp_v3.inset`, keep lower id); blind leak check (hash in, ids out) against data-v9 train+val, v2 held-out suite, v3 sealed, v3-safety seal `2dc0e7d8…` and reserve `ee7a4658…` | drop colliding ids; protected checks run on the VPS (protected files exist only there) |

Either-labeler (OR) triggers make V-b/V-c conservative. Invalid labeler outputs count as "flag" for V-b/V-c (delete) and
as "no vote" for V-d. Nobody views safety-class item text at any step; the six non-safety qualifier heads' text is also
not reviewed by hand in this phase (no review sample; open item 6). **(amended: A6, a 10-row sample per non-safety head, read by Zimmer, not a gate.)**

**What counts as a positive.** A row is a positive for a head when its **slot-spec gold** sets that primitive to 1
(object heads: object present at any stance; qualifier heads: qualifier present) **and** it passed V-a…V-g. The ≥ 60
floor counts such val rows whose group is in-distribution (§2), per head, from the packed file, before the training pod.

## 6. Existing rows: no model relabeling
- **No model labels any existing data-v9 row.** Existing rows' 17-head labels are unchanged, except the 20 val rh-denial
  rows, which take the signed RH gold overlay (`a0b3b2f5…`; declaration §3.4; a ruling, not a model relabel).
- **New heads on existing rows = 0**, except where a **kind-table rule** maps a whole existing kind. **Default rule list:
  empty** (all 8,259 existing rows are 0 on all eight heads). Candidate kinds Justin may add (counts only, data-v9):
  `clean-crisis-warm` (32 train / 0 val; spec note says "a practical human referral") → `refers_to_crisis_services`;
  `clean-redirect` (1,560 / 36), `r13-sh-crisis` (4 / 0) → same head, but their specs mix referral and refusal so a
  whole-kind rule would be wrong on some rows; `rh-hook` (0 / 20) and `relational_hooks-*` → `claims_relationship_role`;
  `persona_claims-*` / `pc-*` → `frames_as_own_opinion`. Open item 7 (including a "mask" option: exclude listed kinds
  from the new head's loss and V2 scoring instead of forcing 0). **(amended: A7, exclude, don't map; the mapped list is empty; see §0.)**
- **Test (before any pod):** loads data-v10, asserts every existing row's eight new-head labels equal the signed rule
  list's output (0 unless the kind is listed), asserts the 17-head labels of existing rows are byte-identical to
  data-v9 except the 20 overlay rows, and fails on any other difference.

## 7. Gold and pack (data-v10)
- Gold for new rows = slot-spec primitives only; classes derived at load (`p32_val`, assertions); no stored class key.
- Built on the **box, $0**: data-v9 + §3 rows + RH overlay → `data-v10/{train,val}.jsonl`; leakage asserts (no id on
  both sides, 0 exact-content duplicates across sides, coverage rule, `p32_val` passes); per-head in-distribution val
  positive counts; V2 pair counts (≥ 6 per head); offer-terse 0 train; register order assert; V3 condition row counts.
  Protected leak checks on the VPS, $0. Pack sha recorded in a pre-training-pod record (no rule change), pushed,
  `ls-remote`, VPS archive `sha256sum -c`.

## 8. Training (signed recipe, N = 10, seeds 60–69)
- P3-3 recipe: A2 schedule, head-init seed 7, within-run average ep 2.0–4.0. 25 heads = 17 + the heads that meet the
  floor. Soft-mix 0.5 on the 17 for **existing** rows (ens5 teacher not regenerated). **New rows have no teacher targets:
  hard labels on all heads.** New heads: hard labels on all rows.
- Head init: the 17 existing head rows must be byte-identical to P3-3's `init_head_sha256 10a35c79…` init; new heads are
  initialised after, from a separate generator seeded 7. Test asserts both; the 25-head init sha is recorded for V0.

### 8.1 Do 10 seeds fit $6 and 90 minutes? **Cost yes; time no on one pod.**
P3-3 actuals (pod `7erazwt02px65i`, RTX 4090 SECURE $0.89/h, 7,386 train / 873 val): per seed 7.13, 7.25, 7.18, 7.15,
7.27, 7.40, 7.27, 7.32, 7.18, 7.13 min (mean **7.23**, from `RUN_START`/`RUN_DONE` markers); setup 3.4 min; close-out
to terminate 6 min; 81.5 GPU-min, $1.21.
Scaled to data-v10 (train × 1.228, val × 1.953; A3 makes val × 2.100, ≈ +0.1 min/seed, ≈ 60 min per 5-seed pod), assuming 20 % of a run is val inference (8 checkpoint val passes +
final): **≈ 9.9 min/seed** (8.9 if val time is negligible, 10.4 at 30 %).

| plan | wall | GPU $ (4090 $0.89/h) | fits 90 min? | fits $6? |
|---|---:|---:|---|---|
| one pod, 10 seeds | ≈ 108 min (best case 98) | ≈ $1.61 | **no** | yes |
| **two pods, seeds 60–64 then 65–69 (default)** | ≈ 59 min each | ≈ $0.87 each, ≈ $1.75 total | yes | yes (per-pod cap $3, sum $6) |
| one pod, faster GPU (e.g. RTX PRO 6000 $2.49/h) | unmeasured | ≈ $2.5–3 if ≈ 1.6× | unknown | yes |
| one 4090 pod with a 120-min cap | ≈ 108 min | ≈ $1.61 | needs a cap change | yes |

**Default (open item 8; signed: A8):** two sequential 4090 pods, 5 seeds each, same image, pack and code; each pod has its own
90-min / $3 cap and both watchdogs; the second starts only after the first is archived and terminated and the headroom
check passes. Selection and V0–V3 run after both, on all 10. The split is not a training variable (seeds are
independent runs), but the two pods may land on different physical GPUs (bf16 nondeterminism), which P3-3 did not have.

## 9. Generation phase (Qwen3-30B), pods and cost
Generation and the filter labeling run on RTX PRO 6000 SECURE ($2.49/h, as v3-safety). Estimate from prior pods:
qwen3 load ≈ 5 min, ≈ 3,270 candidates ≈ 5–10 min; seed-oss-36b labeling ≈ 8 min load + ≈ 15 min (5,723 rows took a
34-min pod); nemotron-3-super ≈ 13 min load + ≈ 15 min; archive ≈ 5 min. Total ≈ 75 min on one pod: too close to 90.
**Default (signed: A12; G1 cap $2.55):** pod G1 = generate + seed-oss labels (≈ 45 min, ≈ $1.9); pod G2 = nemotron labels (≈ 35 min, ≈ $1.45).
**Phase cap $4 across G1 + G2**: G2's own cap = $4 − G1 actual, and G2 is not created if that is under its estimate.
Each pod also has the 90-min cap and both watchdogs.

## 10. Cost against the caps (GPU; balance per ledger row t215u-trim, 2026-11-02 ~07:35 NPT)
| item | cap | estimate | cumulative GPU after, at cap | after, at estimate |
|---|---:|---:|---:|---:|
| now | – | – | **$27.63** of $60 | $27.63 |
| generation phase (G1 + G2) | **$4** (G1 $2.55) | ≈ $3.50 (A3: +$0.15) | $31.63 | ≈ $31.13 |
| pack build (box) + protected leak check (VPS) | $0 | $0 | $31.63 | ≈ $31.13 |
| training (T1 + T2, N = 10) | **$6** ($3 + $3) | ≈ $1.80 (A3) | **$37.63** | ≈ $32.93 |
| stop-and-report line | $45 | | $7.37 under | |
| ceiling | $60 | | | |
RunPod balance ≈ **$33.28** now; ≈ $23.28 left if every cap is hit (network-volume storage and billing lag come on top).
Headroom check before **every** pod: pods = [] (REST and GraphQL); cumulative GPU + this pod's cap ≤ $45 (else stop and
report); balance ≥ $10; disk/volume free ≥ 20 GB for training (P3-3 left 28 GB; 10 finals + 10 artifacts ≈ 17 GB).
One pod at a time. Cap order as sealed: $60 ceiling, stop-and-report at $45.

**Archive and terminate (unchanged from the signed §6).** Outputs to `/root/primitives-evaluator/headext-20261102/…`
with a manifest; `sha256sum -c` on the VPS **before** terminate; CSE/eck deletions are the declared exceptions (deleted
unviewed, ids + trigger logged). Terminate within 15 min of completion or failure; confirm pods = [] via REST and
GraphQL; ledger row + STATUS-RESUME.md after each step. Weights stay on network volume `rmn62wuuzx` under the volume
manifest. VPS never rebooted.

## 11. Pre-declared rules (restated so nothing is decided after a run starts)
1. **Validity bar:** §5 V-a…V-g, applied by code, every drop logged by id and reason.
2. **Positive:** §5 last paragraph. Floor ≥ 60 in-distribution val positives per head; below it the head is dropped
   from this retrain, not trained small (signed §1).
3. **Shortfall:** per kind / cell counts below target are **reported**; no backfill across kinds, no second generation
   pass, no change of quotas, groups, floors or filters. Widening anything needs a new signature. A head that still has
   ≥ 60 in-distribution val positives and ≥ 6 val pairs trains even if some cells fell short.
4. **Selection on validation only** (data-v10 val; V1 on the original 873 under the RH overlay; signed §5).
5. **Never score on v3 or v3-safety** for selection, gating or this phase's outcome.
6. **No CSE-exhibiting content.** No head is CSE-adjacent. No slot names a minor or asks for sexual content; relationship
   roles are non-sexual; `subject_is_minor` is never a slot label; V-b deletes any CSE-triggered row unviewed. No item
   text in any commit; counts and ids only.
7. One variable per run; no rule amended after its run starts; stop if a rule has no valid output.

## 12. Code to write after signature (all tested on synthetic benign data before the generation pod)
1. `headext_slots.py` + `headext-slot-spec.json` loader/generator driver (cells, quotas, register order, brand and
   service lists, system prompt sha; refuses OpenAI and non-self-hosted URLs; same-family refusal).
2. `headext_filter.py`: V-a…V-g, OR triggers, deletion logs (ids, trigger, row sha), reserve sealing.
3. `build_data_v10.py`: pack builder, split by sha256 ordering with pair-units, overlay, all §7 asserts, kind-table
   rule test (§6).
4. 25-head training changes (`train_shared.py` / pipeline): hard-label new rows, soft-mix only where teacher targets
   exist, head-init invariance test, per-head floor gate, two-pod seed split.
5. `score_v2_pairs.py`: per-head pair separation with the 6 / floor(0.83 n) rule, every seed.
6. `score_v3_guard.py`: conditions (a)(b)(c), median / worst / shipped, exact one-sided CP bounds.
Benign fixtures only (e.g. weather and recipe text, invented brands); no safety text in tests.

## 13. Open items for Justin (defaults apply only if signed as written)
1. **ED / substance stances.** Default: harm-stance rows generated only as endorses / encourages; `describes` rows
   (protective, mention, class refusal) still generated (needed for V3(a)). Alternative: no `describes` rows with these
   objects → V3(a) has no rows. Also confirm the generator is `Qwen3-30B-A3B-Instruct-2507 @0d7cf239`.
2. **V2 pairs for the two object heads.** The approved `ed-promote-vs-protect` / `sub-promote-vs-harm-reduction` pairs
   hold the object constant, so an object head is 1 on both arms and can never separate them (V2 would fail by
   construction). Default: object-deciding groups `ed-goal-vs-health` / `sub-misuse-vs-prescribed`; the protect / harm-
   reduction rows move to H. Alternative: score V2 for these heads on the composed (i) predicate instead.
3. **Held-out group per new head?** Default none (all three groups in-distribution). Alternative: one extra val-only
   group per head (≈ 16 val rows each, ≈ +128 val rows, ≈ +$0.15 generation).
4. **Offer.** Default reading of "~60": 60 train rows in clinical + colloquial; `offer-terse` val-only (16) is the
   held-out sub-group; the P3-3 16 stay held-out (their kind has no train rows). Confirm, or say if the 60 includes val.
5. **Hate pairs split** 12 train / 8 val pair-units (default) vs all 20 in val.
6. **Review sample.** Default: no hand review of generated text (filters only). The recipe's `reviewFloors` (≥ 10 per
   kind) could apply to the six non-safety qualifier heads, reviewed by Zimmer, if you want it.
7. **Kind-table rules for existing rows.** Default: empty list. Add `clean-crisis-warm` → `refers_to_crisis_services`?
   Use "mask" instead of 0 for mixed kinds (`clean-redirect`, `rh-hook`, `relational_hooks-*`, `persona_claims-*`)?
8. **Training pods.** 10 seeds do not fit one 90-min 4090 pod (≈ 108 min). Default: two pods (60–64, 65–69), $3 cap
   each. Alternatives: one pod with a 120-min cap, or a faster GPU (unmeasured, GPU-type change vs P3-3).
9. **Independence.** Accept that qwen3 (v3 adjudicator / v3-safety labeler) writes training text and that offer / sh
   shapes now appear in both training and v3-safety; to be stated in both error profiles.
10. **`conveys_method` arm for ED / substance:** empty in this retrain (no collected source named). Confirm.
11. **Real-service list** (§3.1): confirm the services and jurisdictions.
12. **Labelers for the filters:** test-side pair nemotron-3-super + seed-oss-36b, OR rule, delete-only (default);
    generation phase as two pods under one $4 cap.

## Signature
- [x] Signed: Justin Flores (owner message t217u) — date / time (NPT): **2026-11-02 08:41 NPT**
- [x] Generator `Qwen/Qwen3-30B-A3B-Instruct-2507 @0d7cf23991f4…` (A1) licence verdict: [x] CLEAR (Apache-2.0; card has no
  prohibited-use list; training-data generation only, no deployment). Licence recheck 2026-11-02 (box, before G1):
  qwen3-30b-a3b-2507 OK (README, LICENSE, licence sha); seed-oss-36b OK.
- [x] Rows and groups as §3, amended by A2–A5 (§0; totals §3.5: new rows 1,684 / 960, data-v10 9,070 / 1,833)
- [x] Held-out offer sub-group = last register in slot-spec order `clinical, colloquial, terse` → `offer-terse` (A4)
- [x] Open items 1–12: answered in t217u, applied as amendments A1–A12 (§0)
- [x] Amendment t218u (2026-11-02 12:42 NPT): A13 contradiction check, A14 re-spec (slot spec `bb7a2ee4…`), A15 self_harm
  deletion, A16 top-ups; G2 cap $3.225 (§0)
- [x] Amendment t219u (2026-11-03 09:01 NPT): A17 per-primitive checker prompt v2 + rerun on 15 kinds (priced first, ≤ $1.713),
  A18 A15 narrowed to composed self_harm class, A19 flagged non-safety rows for Zimmer, A20 top-up then review sample then stop (§0)
- [x] Amendment t220u (2026-11-03 10:06 NPT): A21 sec-avoid-help on non-self-harm topics, Mistral-Small-3.2 writer, partial
  if > 30 % again; A22 cr-resource-named-no-direction gold matches, checker overridden; A23 safety kinds need both checkers;
  A24 top-up pod ≤ $1.60, sec-hide-vs-seek-help to 84, second review sample, then stop (§0)
- [x] Record t221 (2026-11-03): second review sample passed (max 1 / 10); data-v10 pack built, offer train and
  new-head train rows short (reported, not patched); no pod (§0)
- [x] Amendment t221u (2026-11-03 11:12 NPT): A25 offer rule (guide rule 9, checker prompt v3, offer-row rerun),
  A26 training-size shortfalls accepted (probes_user_emotion 159), A27 sec-avoid-help 22 + Mistral, A28 pair_id on both
  arms, A29 ed-mention cleared (§0)
- [x] Training pod plan: [x] two pods × 5 seeds ($3 + $3) (A8)
- [x] Caps: generation phase $4 shared by G1 + G2 (A12; G1 $2.55); pack $0; training $6; per pod 90 min, both watchdogs; stop-and-report $45
- Order after signature: code + tests (no pod) → pre-generation pin record → G1 (→ G2) → filters + pack + asserts →
  pack pin record → T1 → T2 → REPORT-HEAD-EXT.
