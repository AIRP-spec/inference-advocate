// Composition: primitives -> AIRP classes. Standalone Node port (no build, no deps)
// of packages/evaluator-local/src/compose-primitives.ts; see ../airp_v3/compose.py for notes.
//
// Library: import { compose, loadComposition } from './compose.mjs'
// CLI:     node node/compose.mjs [--composition FILE] < rows.jsonl   (rows {id,stance,objects,qualifiers})
//          node node/compose.mjs --stance depicts --objects violence_person
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const COMPOSITION_2A_SHA256 = '59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e';
export const DEFAULT_COMPOSITION = join(dirname(fileURLToPath(import.meta.url)), '..', 'spec', 'composition-2a.json');

export function loadComposition(path = DEFAULT_COMPOSITION, expectSha256 = path === DEFAULT_COMPOSITION ? COMPOSITION_2A_SHA256 : null) {
  const raw = readFileSync(path);
  if (expectSha256) {
    const got = createHash('sha256').update(raw).digest('hex');
    if (got !== expectSha256) throw new Error(`composition sha256 ${got} != expected ${expectSha256}`);
  }
  return JSON.parse(raw.toString('utf8'));
}

function matches(p, c) {
  if (c.allOf) return c.allOf.every((x) => matches(p, x));
  if (c.anyOf) return c.anyOf.some((x) => matches(p, x));
  if (c.stance && p.stance !== c.stance) return false;
  if (c.objects && !c.objects.every((o) => p.objects.includes(o))) return false;
  if (c.qualifiers && !c.qualifiers.every((q) => p.qualifiers.includes(q))) return false;
  return true;
}

function suppressed(p, rules) {
  for (const r of rules || []) {
    if (matches(p, r.condition)) {
      if (r.condition.qualifiers && r.condition.qualifiers.includes('is_mention_not_use')) {
        if (p.stance === 'describes') return true;
        continue;
      }
      return true;
    }
  }
  return false;
}

export function compose(prims, composition = loadComposition()) {
  const p = { stance: prims.stance, objects: prims.objects || [], qualifiers: prims.qualifiers || [] };
  if (suppressed(p, composition.negativeRules)) return [];
  const out = [];
  for (const cr of composition.classes) {
    if (cr.unsupported || !cr.rule || cr.rule.none) continue;
    if (matches(p, cr.rule)) out.push(cr.class);
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  const val = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const list = (k) => { const i = argv.indexOf(k); if (i < 0) return []; const o = []; for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) o.push(argv[j]); return o; };
  const comp = val('--composition') ? loadComposition(val('--composition'), null) : loadComposition();
  if (val('--stance')) {
    console.log(JSON.stringify(compose({ stance: val('--stance'), objects: list('--objects'), qualifiers: list('--qualifiers') }, comp)));
  } else {
    const lines = readFileSync(0, 'utf8').split('\n').filter((l) => l.trim());
    for (const l of lines) { const r = JSON.parse(l); console.log(JSON.stringify({ id: r.id ?? null, classes: compose(r, comp) })); }
  }
}
