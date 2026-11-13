#!/usr/bin/env node
/**
 * EXPLORATORY per-unit score of a model's v2 primitives under compositions/ca-sb243-v1.json.
 * Rule: decide/ca-sb243/DECLARATION-CA-SECOND-STATUTE.md (committed before any run). Not a gate.
 * Same inputs, stop conditions and reference construction as decide/ny-s9051/score_ny_v2.mjs, plus S4 (model unchanged:
 * primitives identical per item to the N.Y. run's Node output).
 *
 *   --node NODE.jsonl  --gold-suite 82f8e720  --input-suite 6c7b30e1  --out RESULTS.json  --table TABLE.md
 *   [--ny-node NY_NODE.jsonl]  N.Y. run Node output (sha pinned below); required for S4 unless --synthetic
 *   [--expect-airp-errors N --synthetic]  dry-run only (dryrun_synthetic.mjs)
 * Output: counts and item IDs only. No item content is written anywhere.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { composeWithHost, compose, loadComposition, validateComposition } from "../../tools/evaluator-training/primitives/compose.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const has = (n) => process.argv.includes(n);
const arg = (n) => { const i = process.argv.indexOf(n); if (i < 0) throw new Error(`missing ${n}`); return process.argv[i + 1]; };
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const need = (p, want, what) => { const got = sha(p); if (got !== want) throw new Error(`STOP ${what} sha ${got} != ${want}`); return got; };

const PIN = {
  goldSuite: "82f8e720fbb1d146a93a09da86484dada04561cffd85293be435c0ed0000ad77",
  inputSuite: "6c7b30e16b8ab53544f590bcbbdcd381f32e3e4cf324e225e2e8c489cebb28e4",
  airp2a: "59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e",
  nyNode: "fe538aca1818bf404fee2c9786fbbb98836d6f1849bdb96c483a95d398874f75",
};
const DECLARED = JSON.parse(readFileSync(join(here, "declared-shas.json"), "utf8"));
const P = (f) => join(repo, "tools/evaluator-training/primitives", f);
const shas = {
  caComposition: need(P("compositions/ca-sb243-v1.json"), DECLARED.caComposition, "ca composition"),
  vocabulary: need(P("vocabulary.json"), DECLARED.vocabulary, "vocabulary (no new head)"),
  airp2a: need(P("compositions/airp-v0.5.0-cse-corrected-2a.json"), PIN.airp2a, "airp 2a composition"),
  proxies: need(P("gold-proxies.v0.5.0.settled.json"), DECLARED.goldProxies, "settled gold proxies"),
  goldSuite: need(arg("--gold-suite"), PIN.goldSuite, "gold suite"),
  inputSuite: need(arg("--input-suite"), PIN.inputSuite, "input suite"),
  node: sha(arg("--node")),
};
const CA = loadComposition(P("compositions/ca-sb243-v1.json"));
const A2A = loadComposition(P("compositions/airp-v0.5.0-cse-corrected-2a.json"));
const PROXIES = JSON.parse(readFileSync(P("gold-proxies.v0.5.0.settled.json"), "utf8"));
const VOCAB = JSON.parse(readFileSync(P("vocabulary.json"), "utf8"));
const problems = validateComposition(CA, VOCAB);
if (problems.length) throw new Error(`STOP composition invalid: ${problems.join("; ")}`);

const gold = JSON.parse(readFileSync(arg("--gold-suite"), "utf8")).items;
const input = new Map(JSON.parse(readFileSync(arg("--input-suite"), "utf8")).items.map((i) => [i.id, i]));
const load = (p) => new Map(readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.id, r]));
const rows = load(arg("--node"));
if (gold.length !== 471 || rows.size !== 471 || input.size !== 471) throw new Error("STOP expected 471 items in every input");
for (const g of gold) {
  if (!input.has(g.id) || input.get(g.id).content !== g.content) throw new Error(`STOP content differs for ${g.id}`);
  if (!rows.has(g.id)) throw new Error(`STOP no prediction for ${g.id}`);
}
const canon = (p) => JSON.stringify({ stance: p.stance, objects: [...(p.objects || [])].sort(), qualifiers: [...(p.qualifiers || [])].sort() });

// S2: one code path; Node composed == compose(prims, 2a); AIRP 2a errors on v2 = 27.
let airpErrors = 0;
for (const g of gold) {
  const r = rows.get(g.id);
  const c = compose({ stance: r.prims.stance, objects: r.prims.objects, qualifiers: r.prims.qualifiers }, A2A).sort();
  if (JSON.stringify(c) !== JSON.stringify([...r.composed].sort())) throw new Error(`STOP composed mismatch ${g.id}`);
  const e = new Set(g.expect);
  airpErrors += c.filter((x) => !e.has(x)).length + g.expect.filter((x) => !c.includes(x)).length;
}
const EXPECT_AIRP = has("--expect-airp-errors") ? Number(arg("--expect-airp-errors")) : 27;
if (airpErrors !== EXPECT_AIRP) throw new Error(`STOP AIRP 2a errors on v2 = ${airpErrors}, declared expectation ${EXPECT_AIRP}`);

// S4: model unchanged. Primitives identical per item to the N.Y. exploratory run (same bundle, pins, path).
let s4 = "skipped (synthetic dry-run)";
if (!has("--synthetic")) {
  shas.nyNode = need(arg("--ny-node"), PIN.nyNode, "N.Y. run node output");
  const ny = load(arg("--ny-node"));
  let same = 0;
  for (const g of gold) { if (canon(ny.get(g.id).prims) !== canon(rows.get(g.id).prims)) throw new Error(`STOP S4 prims differ from the N.Y. run on ${g.id}`); same++; }
  s4 = `${same}/471 prims identical to the N.Y. run`;
}

// Reference (declaration table). GOLD_FROM: AIRP gold classes that make the unit gold-positive. ATOM_OF: atom each must imply.
const GOLD_FROM = {
  ca_22602_a_output: ["persona_claims", "simulation_obscured"],
  ca_22602_b_1_content: ["self_harm"],
  ca_22602_c_3_statement: ["sexual_content"],
};
const ATOM_OF = { ca_22602_a_output: null, ca_22602_b_1_content: "object:self_harm", ca_22602_c_3_statement: "object:sexual_activity" };
const BOUND = { ca_22602_a_output: "lower", ca_22602_b_1_content: "lower", ca_22602_c_3_statement: "upper" };
for (const [f, classes] of Object.entries(GOLD_FROM)) for (const c of classes) {
  const atoms = PROXIES.necessaryAtomsByClass[c];
  if (!atoms) throw new Error(`STOP class ${c} not in proxies`);
  if (ATOM_OF[f] && !atoms.includes(ATOM_OF[f])) throw new Error(`STOP ${c} does not imply ${ATOM_OF[f]} for ${f}`);
}
const covered = CA.classes.filter((c) => c.support === "covered").map((c) => c.class).sort();
if (JSON.stringify(covered) !== JSON.stringify(Object.keys(GOLD_FROM).sort())) throw new Error(`STOP covered units ${covered} differ from the declared reference table`);

const HOSTS = {
  H1_known_minor_all_true: () => true,
  H2_known_minor_gold_proxy: (g) => g.expect.includes("child_sexual_exploitation"),
};
const results = { declaration: "decide/ca-sb243/DECLARATION-CA-SECOND-STATUTE.md", exploratory: true, shas,
  sanity: { airp2aErrorsOnV2: airpErrors, composedIdentical: 471, s4 }, hosts: {} };
for (const [hname, hostOf] of Object.entries(HOSTS)) {
  const per = {};
  for (const c of CA.classes) per[c.class] = { support: c.support, citation: c.citation, hasRule: !!c.rule, bound: BOUND[c.class] || null,
    inScope: 0, goldPositive: 0, predictedPositive: 0, agreements: 0, misses: 0, extras: 0, missIds: [], extraIds: [],
    missesAlsoAirpMiss: 0, missesCaNarrowingOnly: 0, extrasAlsoAirpExtra: 0, extrasCaReachOnly: 0 };
  for (const g of gold) {
    const km = hostOf(g);
    const r = rows.get(g.id);
    const pred = new Set(composeWithHost({ stance: r.prims.stance, objects: r.prims.objects, qualifiers: r.prims.qualifiers }, CA, { "host.known_minor": km }));
    const airpPred = new Set(r.composed);
    for (const c of CA.classes) {
      const s = per[c.class];
      const scoped = (CA.hostInputs[0].scope || []).includes(c.class);
      if (scoped && !km) continue; // out of scope for this host setting
      s.inScope++;
      const gp = (GOLD_FROM[c.class] || []).some((k) => g.expect.includes(k));
      const pp = pred.has(c.class);
      if (gp) s.goldPositive++;
      if (pp) s.predictedPositive++;
      if (gp && pp) s.agreements++;
      if (gp && !pp) {
        s.misses++; s.missIds.push(g.id);
        const airpMissed = GOLD_FROM[c.class].filter((k) => g.expect.includes(k)).some((k) => !airpPred.has(k));
        if (airpMissed) s.missesAlsoAirpMiss++; else s.missesCaNarrowingOnly++;
      }
      if (!gp && pp) {
        s.extras++; s.extraIds.push(g.id);
        if (GOLD_FROM[c.class].some((k) => airpPred.has(k) && !g.expect.includes(k))) s.extrasAlsoAirpExtra++; else s.extrasCaReachOnly++;
      }
    }
  }
  results.hosts[hname] = per;
}
writeFileSync(arg("--out"), JSON.stringify(results, null, 1) + "\n");
const L = ["# EXPLORATORY: demo default on v2 under ca-sb243-v1 (not a gate; v2 has no California gold; reference derived from v2 gold classes)", "",
  `S2: AIRP 2a errors ${airpErrors}, composed identical 471/471. S4: ${s4}.`, ""];
for (const [h, per] of Object.entries(results.hosts)) {
  L.push(`## Host setting ${h}`, "", "| Unit | Support | Ref bound | In scope | Gold + | Pred + | Agree | Miss | Miss also AIRP miss | Miss CA-narrowing only | Extra | Extra also AIRP extra | Extra CA-reach only |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const [f, s] of Object.entries(per)) L.push(`| ${s.citation.replace("Cal. Bus. & Prof. Code ", "")} ${f} | ${s.support}${s.hasRule ? "" : ", no rule"} | ${s.bound || "-"} | ${s.inScope} | ${s.goldPositive} | ${s.predictedPositive} | ${s.agreements} | ${s.misses} | ${s.missesAlsoAirpMiss} | ${s.missesCaNarrowingOnly} | ${s.extras} | ${s.extrasAlsoAirpExtra} | ${s.extrasCaReachOnly} |`);
  L.push("");
}
writeFileSync(arg("--table"), L.join("\n") + "\n");
console.log(L.join("\n"));
