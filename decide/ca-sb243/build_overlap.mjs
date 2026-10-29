#!/usr/bin/env node
/**
 * Overlap analysis (declared in DECLARATION-CA-SECOND-STATUTE.md, analysis only, no bar): which statutory units of
 * ny-s9051-v1 and ca-sb243-v1 need which model heads, and how many distinct heads both statutes need together.
 * Heads, not primitives: the model has 17 heads (1 stance head over 5 stances, 7 object heads, 9 qualifier heads), so any
 * stance condition counts as the one `stance` head. Required heads of a unit = heads referenced by its rule (host inputs
 * excluded, they are not heads) plus its missingPrimitives (each one a proposed new head).
 * Usage: node build_overlap.mjs OUT.json OUT.md
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadComposition } from "../../tools/evaluator-training/primitives/compose.mjs";
const P = (f) => new URL(`../../tools/evaluator-training/primitives/${f}`, import.meta.url).pathname;
const VOCAB = JSON.parse(readFileSync(P("vocabulary.json"), "utf8"));
const HEADS17 = ["stance", ...VOCAB.primitives.object.map((p) => p.primitive), ...VOCAB.primitives.qualifiers.map((p) => p.primitive)];
if (HEADS17.length !== 17) throw new Error(`expected 17 heads, got ${HEADS17.length}`);
const atoms = (cond, out = new Set()) => {
  if (!cond) return out;
  if (cond.stance) out.add("stance");
  for (const o of cond.objects || []) out.add(o);
  for (const q of cond.qualifiers || []) if (!q.startsWith("host.")) out.add(q);
  for (const c of [...(cond.allOf || []), ...(cond.anyOf || [])]) atoms(c, out);
  return out;
};
const statutes = { NY: loadComposition(P("compositions/ny-s9051-v1.json")), CA: loadComposition(P("compositions/ca-sb243-v1.json")) };
const units = [];
for (const [st, comp] of Object.entries(statutes)) for (const c of comp.classes) {
  const existing = [...atoms(c.rule)].sort();
  const missing = [...(c.missingPrimitives || [])].sort();
  for (const h of existing) if (!HEADS17.includes(h)) throw new Error(`${c.class}: ${h} is not one of the 17 heads`);
  units.push({ statute: st, unit: c.class, citation: c.citation, support: c.support, existingHeads: existing, missingHeads: missing,
    hostInputs: [...new Set(JSON.stringify(c.rule || {}).match(/host\.[a-z_]+/g) || [])] });
}
// The mention rule (negativeRules) applies to every unit of a statute, so its heads count as used by that statute.
const negHeads = Object.fromEntries(Object.entries(statutes).map(([st, comp]) => [st, [...(comp.negativeRules || []).reduce((s, r) => atoms(r.condition, s), new Set())]]));
const need = (st, key) => new Set([...units.filter((u) => !st || u.statute === st).flatMap((u) => u[key]), ...(key === "existingHeads" ? negHeads[st] : [])]);
const ny17 = need("NY", "existingHeads"), ca17 = need("CA", "existingHeads"), nyNew = need("NY", "missingHeads"), caNew = need("CA", "missingHeads");
const union17 = new Set([...ny17, ...ca17]), unionNew = new Set([...nyNew, ...caNew]);
const count = (st, s) => units.filter((u) => u.statute === st && u.support === s).length;
const summary = {};
for (const st of ["NY", "CA"]) {
  const n = units.filter((u) => u.statute === st).length, cov = count(st, "covered"), par = count(st, "partial");
  summary[st] = { units: n, covered: cov, partial: par, hostEvidence: count(st, "host-evidence"), pendingRegulation: count(st, "pending-regulation"),
    reachableShareAllUnits: `${cov}/${n}`, reachableShareResponseLevel: `${cov}/${cov + par}` };
}
const sharedPairs = [];
for (const a of units.filter((u) => u.statute === "NY" && u.existingHeads.length)) for (const b of units.filter((u) => u.statute === "CA" && u.existingHeads.length)) {
  const shared = a.existingHeads.filter((h) => b.existingHeads.includes(h));
  const contentShared = shared.filter((h) => h !== "stance");
  if (contentShared.length) sharedPairs.push({ ny: a.unit, ca: b.unit, sharedHeads: shared });
}
const out = {
  analysisOnly: true, heads17: HEADS17, negativeRuleHeads: negHeads, units, summary, sharedPairs,
  heads: {
    nyExisting: [...ny17].sort(), caExisting: [...ca17].sort(), unionExisting: [...union17].sort(),
    caExistingNotUsedByNy: [...ca17].filter((h) => !ny17.has(h)).sort(),
    unused17: HEADS17.filter((h) => !union17.has(h)),
    nyMissing: [...nyNew].sort(), caMissing: [...caNew].sort(), caMissingBeyondNy: [...caNew].filter((h) => !nyNew.has(h)).sort(),
    distinctHeadsNeededBothStatutes: union17.size + unionNew.size,
  },
};
writeFileSync(process.argv[2], JSON.stringify(out, null, 1) + "\n");
const L = ["# Overlap: N.Y. S9051-B § 1800(8) and Cal. SB 243 units to model heads (analysis only)", "",
  "| Statute | Unit | Support | Existing heads | Missing (new) heads | Host inputs |", "|---|---|---|---|---|---|"];
for (const u of units) L.push(`| ${u.statute} | ${u.citation.replace(/^(N\.Y\. Gen\. Bus\. Law|Cal\. Bus\. & Prof\. Code) /, "")} \`${u.unit}\` | ${u.support} | ${u.existingHeads.join(", ") || "-"} | ${u.missingHeads.join(", ") || "-"} | ${u.hostInputs.join(", ") || "-"} |`);
L.push("", "## Summary", "", "| | NY | CA |", "|---|---|---|");
for (const k of ["units", "covered", "partial", "hostEvidence", "pendingRegulation", "reachableShareAllUnits", "reachableShareResponseLevel"]) L.push(`| ${k} | ${summary.NY[k]} | ${summary.CA[k]} |`);
const h = out.heads;
L.push("", `- Mention rule heads (apply to every unit): NY ${negHeads.NY.join(", ")}; CA ${negHeads.CA.join(", ")}.`,
  `- Existing heads used: NY ${h.nyExisting.length} (${h.nyExisting.join(", ")}); CA ${h.caExisting.length} (${h.caExisting.join(", ")}).`,
  `- Existing heads CA uses that NY does not: ${h.caExistingNotUsedByNy.length ? h.caExistingNotUsedByNy.join(", ") : "none"}.`,
  `- Union of existing heads used: ${h.unionExisting.length} of 17. Unused by both: ${h.unused17.join(", ")}.`,
  `- New heads NY needs: ${h.nyMissing.length} (${h.nyMissing.join(", ")}). New heads CA needs: ${h.caMissing.length} (${h.caMissing.join(", ")}); beyond NY's: ${h.caMissingBeyondNy.length} (${h.caMissingBeyondNy.join(", ") || "none"}).`,
  `- Distinct heads needed to cover every response-level unit of both statutes: ${h.distinctHeadsNeededBothStatutes} (${h.unionExisting.length} existing + ${h.nyMissing.length + h.caMissingBeyondNy.length} new).`,
  "", "### Unit pairs sharing a content head (stance alone not counted)", "", "| NY unit | CA unit | Shared heads |", "|---|---|---|");
for (const p of sharedPairs) L.push(`| ${p.ny} | ${p.ca} | ${p.sharedHeads.join(", ")} |`);
writeFileSync(process.argv[3], L.join("\n") + "\n");
console.log(L.join("\n"));
