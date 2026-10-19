// Composition-swap demo on fixed primitives (no retraining): avg-f05-s14 held-out primitives (torch CPU record) composed through
// several composition files, scored against the amended suite (82f8e720) with E = extra class fires, M = items missing an expected class.
import { readFileSync } from 'node:fs';
const [repo, prims, suitePath, ...comps] = process.argv.slice(2);
const { compose } = await import(repo + '/packages/evaluator-local/dist/index.js');
const gold = Object.fromEntries(JSON.parse(readFileSync(suitePath, 'utf8')).items.map((i) => [i.id, i.expect]));
const P = readFileSync(prims, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
for (const c of comps) {
  const comp = JSON.parse(readFileSync(c, 'utf8')); let E = 0, M = 0, cse = { miss: 0, extra: 0 }, n = 0;
  for (const p of P) { const got = compose({ stance: p.stance, objects: p.objects, qualifiers: p.qualifiers }, comp); const exp = gold[p.id]; n++;
    const extra = got.filter((t) => !exp.includes(t)); E += extra.length; if (exp.some((t) => !got.includes(t))) M++;
    if (exp.includes('child_sexual_exploitation') && !got.includes('child_sexual_exploitation')) cse.miss++; if (!exp.includes('child_sexual_exploitation') && got.includes('child_sexual_exploitation')) cse.extra++; }
  console.log(JSON.stringify({ composition: comp.compositionVersion, n, E, M, EM: E + M, cse }));
}
