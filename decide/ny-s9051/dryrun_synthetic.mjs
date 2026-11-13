#!/usr/bin/env node
// Synthetic dry-run of score_ny_v2.mjs: builds primitives FROM v2 GOLD (no model) so the reference should be reproduced
// exactly (0 misses, 0 extras on every feature with a rule). Exercises the code path; scores no model.
import { readFileSync, writeFileSync } from "node:fs";
import { compose, loadComposition } from "../../tools/evaluator-training/primitives/compose.mjs";
const [suite, out] = process.argv.slice(2);
const A2A = loadComposition(new URL("../../tools/evaluator-training/primitives/compositions/airp-v0.5.0-cse-corrected-2a.json", import.meta.url).pathname);
const lines = [];
for (const it of JSON.parse(readFileSync(suite, "utf8")).items) {
  const e = new Set(it.expect), q = [], o = [];
  if (e.has("persona_claims")) q.push("asserts_interior_state");
  if (e.has("simulation_obscured")) q.push("addresses_own_nature");
  if (e.has("sycophancy")) q.push("untethered_to_content");
  if (e.has("relational_hooks")) q.push("directed_at_user");
  if (e.has("self_harm")) o.push("self_harm");
  if (e.has("sexual_content")) o.push("sexual_activity");
  const stance = e.has("relational_hooks") || e.has("self_harm") ? "encourages" : "describes";
  const prims = { stance, objects: o, qualifiers: q };
  lines.push(JSON.stringify({ id: it.id, prims, composed: compose(prims, A2A) }));
}
writeFileSync(out, lines.join("\n") + "\n");
