// ADR 2026-10-19 (val gold classes derived). Load the label-free validation split and DERIVE each row's gold
// classes from its gold primitives through composition 2a, with assertions. Import or run as CLI:
//   node val_gold.mjs --val VAL.jsonl --composition 2a.json [--val-sha SHA] [--out derived.jsonl]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const COMPOSITION_2A_SHA256 = '59ddf1f630ec2dcd81d40dd01f2adb53f1310fe42128d3ccc9b90de61e28ab9e';
export const VAL_SHA256 = '5be292a911f0082a74c6e24beb20a60455fab4a86baded561784d37f2b453009';
export const STORED_CLASS_KEYS = ['expect', 'verdict', 'class', 'expect_classes', 'classes'];
const STANCES = ['conveys_method', 'depicts', 'describes', 'encourages', 'endorses'];
const OBJECTS = ['violence_person', 'self_harm', 'sexual_activity', 'financial_crime', 'intrusion', 'weapons', 'profanity'];
const QUALIFIERS = ['targets_protected_characteristic', 'subject_is_minor', 'asserts_interior_state', 'addresses_own_nature',
  'explicit_register', 'exceeds_common_knowledge', 'is_mention_not_use', 'directed_at_user', 'untethered_to_content'];
// Non-head gold name present in 20 val rows; asserted below to have no effect on 2a.
const IGNORED_GOLD_NAMES = ['criminal_assistance'];
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function assert(c, m) { if (!c) throw new Error('VAL_GOLD_ASSERT: ' + m); }

export async function loadValDerived(valPath, compositionPath, { valSha = VAL_SHA256, repo = process.env.AIRP_REPO || '/workspace/wt29' } = {}) {
  const compRaw = fs.readFileSync(compositionPath);
  assert(sha(compRaw) === COMPOSITION_2A_SHA256, `composition sha ${sha(compRaw)} != 2a`);
  const composition = JSON.parse(compRaw);
  const valRaw = fs.readFileSync(valPath);
  if (valSha) assert(sha(valRaw) === valSha, `val sha ${sha(valRaw)} != pin ${valSha}`);
  const { compose } = await import(pathToFileURL(path.join(repo, 'packages/evaluator-local/dist/index.js')).href);
  const rows = valRaw.toString('utf8').trim().split('\n').map((l) => JSON.parse(l));
  const ids = new Set();
  const known = new Set([...OBJECTS, ...QUALIFIERS]);
  for (const r of rows) {
    assert(!ids.has(r.id), `duplicate id ${r.id}`); ids.add(r.id);
    for (const k of STORED_CLASS_KEYS) assert(!(k in r), `${r.id} carries stored class key "${k}"`);
    assert(STANCES.includes(r.stance), `${r.id} stance ${r.stance}`);
    const names = [...(r.objects || []), ...(r.qualifiers || [])];
    for (const n of names) assert(known.has(n) || IGNORED_GOLD_NAMES.includes(n), `${r.id} unknown primitive ${n}`);
    const prims = { stance: r.stance, objects: r.objects || [], qualifiers: r.qualifiers || [] };
    const derived = compose(prims, composition);
    const clean = compose({ ...prims, objects: prims.objects.filter((o) => known.has(o)) }, composition);
    assert(JSON.stringify([...derived].sort()) === JSON.stringify([...clean].sort()), `${r.id} ignored name changes classes`);
    r.expect_derived = [...derived].sort();
  }
  return { rows, composition, valSha256: sha(valRaw) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const { rows, valSha256 } = await loadValDerived(arg('--val'), arg('--composition'), { valSha: arg('--val-sha') ?? VAL_SHA256 });
  if (arg('--out')) fs.writeFileSync(arg('--out'), rows.map((r) => JSON.stringify({ id: r.id, expect_derived: r.expect_derived })).join('\n') + '\n');
  console.log('VAL_GOLD_OK', rows.length, 'rows', valSha256);
}
