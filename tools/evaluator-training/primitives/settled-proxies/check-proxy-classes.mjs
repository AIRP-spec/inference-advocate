/**
 * Class check for gold proxies (brief 2026-10-05 deciding run, Step 1 item 3).
 *
 * Reuses the existing check verbatim in behaviour:
 *   - PR #26 tools/evaluator-training/primitives/scoring/report-task2.mjs (inline loop, "fail the report if a
 *     proxy names a class not in flags.v0.json")
 *   - PR #27 tools/evaluator-training/laya/gate-laya-task1.mjs `checkProxies` (same rule, throws)
 * Extended only to also walk the settled file's stance section and composite rows, so that no proxy
 * anywhere in the file can name a class outside the eleven v0.5.0 classes. Throws on violation; the
 * rescore script calls it before computing anything, so a bad proxy fails the report.
 */
export function checkProxies(proxies, taxonomy) {
  if (taxonomy.taxonomyVersion !== 'v0.5.0') throw new Error(`taxonomy is ${taxonomy.taxonomyVersion}, expected v0.5.0`);
  const classes = new Set(taxonomy.flags.map((f) => f.type));
  if (classes.size !== 11) throw new Error(`expected 11 v0.5.0 classes, flags.v0.json has ${classes.size}`);
  const bad = [];
  const want = (where, c) => { if (!classes.has(c)) bad.push(`${where} -> ${c}`); };
  for (const [prim, def] of Object.entries(proxies.primitives || {})) {
    for (const c of def.expectIncludes || []) want(prim, c);
    for (const c of def.goldNoIfIncludesAndLacks?.includes || []) want(`${prim}.goldNo.includes`, c);
    for (const c of def.goldNoIfIncludesAndLacks?.lacks || []) want(`${prim}.goldNo.lacks`, c);
  }
  for (const [prim, def] of Object.entries(proxies.composites || {})) {
    for (const c of [...(def.goldYes?.includesAny || []), ...(def.goldYes?.lacks || []), ...(def.goldUnknown?.includesAll || [])]) want(prim, c);
  }
  for (const [cls, allowed] of Object.entries(proxies.stance?.allowedStancesByClass || {})) want(`stance.allowedStancesByClass`, cls);
  for (const [prim, def] of Object.entries(proxies.excluded || {})) for (const c of def.expectIncludes || []) want(`excluded.${prim}`, c);
  if (bad.length) throw new Error(`gold proxy names classes not in flags.v0.json: ${bad.join(', ')}`);
  return [...classes].sort();
}
