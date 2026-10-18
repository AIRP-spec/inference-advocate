import {buildLeakIndex,leakReason,loadHeldOutContentsFromSuite} from '/workspace/airp/decide/shared-adopt/repo/tools/evaluator-training/leak.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const g='/workspace/airp/decide/shared-adopt/repo/data/evaluator-gate/';
const v2=loadHeldOutContentsFromSuite(g+'held-out-suite.v2.json'), v1=loadHeldOutContentsFromSuite(g+'held-out-suite.v1.json');
const idx=buildLeakIndex([...v2,...v1]);
const suite=JSON.parse(readFileSync(g+'held-out-suite.v2.json')).items;
const targetIds=['ho2d-sexual_content-bnd-02','ho2d-child_sexual_exploitation-ctr-03'];
const targets=targetIds.map(id=>suite.find(i=>i.id===id).content);
const rows=readFileSync('rows-draft.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l));
const hits=[];for(const r of rows){const why=leakReason(r.content,idx);if(why)hits.push({id:r.id,content:r.content,reason:why});}
// stricter vs the two targets: repo 4-gram Jaccard at 0.3, plus content-word Jaccard >= 0.25 and any shared 3-word run
const tIdx=buildLeakIndex(targets);
const STOP=new Set('a an the and or of to in on for with no not is it its this that i me my you your he she his her they them their be are was at by from as'.split(' '));
const words=s=>s.toLowerCase().replace(/[^a-z0-9' ]+/g,' ').split(/\s+/).filter(Boolean);
const cw=s=>new Set(words(s).filter(w=>!STOP.has(w)));
const tri=s=>{const w=words(s);const o=new Set();for(let i=0;i+2<w.length;i++)o.add(w.slice(i,i+3).join(' '));return o;};
const jac=(a,b)=>{const i=[...a].filter(x=>b.has(x)).length;const u=new Set([...a,...b]).size;return u?i/u:0;};
const strict=[];let maxCw=0;
for(const r of rows) targets.forEach((t,k)=>{const j=jac(cw(r.content),cw(t));maxCw=Math.max(maxCw,j);const shared3=[...tri(r.content)].filter(x=>tri(t).has(x));
  const rep=leakReason(r.content,tIdx,0.3);if(rep||j>=0.25||shared3.length)strict.push({id:r.id,target:targetIds[k],repo4gram:rep||null,contentWordJaccard:+j.toFixed(3),shared3});});
const MINOR=/\b(child|children|kid|kids|minor|minors|underage|under[- ]?(eighteen|18|sixteen|16|age)|teen|teens|teenager|schoolkids?|school|grade|twelve-year-old|year[- ]old|daughter|son|boy|girl|young|little|petite)\b/i;
const SEX=/\b(sex|sexual|porn|nude|nudes|erotic|erotica|fuck\w*|cock|clit|anal|naked|undress\w*|sexting|steamy|fetish|explicit|strip)\b/i;
const lint=rows.flatMap(r=>{const m=MINOR.test(r.content),s=SEX.test(r.content);const bad=(r.kind.includes('minor')&&s)||(!r.kind.includes('minor')&&m)||(r.kind.includes('minor')&&!m);return bad?[{id:r.id,minorWord:m,sexWord:s}]:[];});
const C=readFileSync('/workspace/airp/decide/shared-adopt/work/gen/corpus.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l).content);
const cIdx=buildLeakIndex(C);const corpusNear=rows.filter(r=>leakReason(r.content,cIdx)).map(r=>({id:r.id,reason:leakReason(r.content,cIdx)}));
const ids=rows.map(r=>r.id);const dup=ids.length-new Set(ids).size;const dupText=rows.length-new Set(rows.map(r=>r.content.toLowerCase())).size;
const out={method:'repo tools/evaluator-training/leak.mjs leakReason (exact, substring>=40 chars, 4-gram Jaccard>=0.5)',heldOut:{v2:v2.length,'v1-207':v1.length},newRows:rows.length,leakHits:hits.length,hits,
 stricterVsTwoTargets:{targets:targetIds,checks:'repo 4-gram Jaccard >= 0.3; content-word Jaccard >= 0.25; any shared 3-word run',hits:strict,maxContentWordJaccard:+maxCw.toFixed(3)},
 lint:{rule:'minor arm: >=1 minor word and 0 sexual words; other arms: 0 minor words',violations:lint},
 nearDuplicateOfCorpus:{corpusRows:C.length,hits:corpusNear},duplicateIds:dup,duplicateTexts:dupText};
writeFileSync('leak-check.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({leak:hits.length,strict:strict.length,maxCw:out.stricterVsTwoTargets.maxContentWordJaccard,lint:lint.length,corpusNear:corpusNear.length,dup,dupText}));
if(strict.length)console.log(JSON.stringify(strict,null,1));
