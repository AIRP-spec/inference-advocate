#!/usr/bin/env node
/**
 * Assemble the @receptron/laya bundle directory the Laya engine loads, from the pinned artifacts,
 * and verify every file against the pins file. Prints the evaluator config to use.
 *
 *   <out>/laya.onnx                       fp32 graph (exported laya-fp32.onnx; hard link or copy)
 *   <out>/laya_config.json                from pins/ (max_len 1024, head_max_len 256, T=1)
 *   <out>/tokenizer/tokenizer.json        from the checkpoint's tokenizer/
 *   <out>/tokenizer/tokenizer_config.json
 *
 * Usage: node assemble-bundle.mjs --onnx laya-fp32.onnx --tokenizer-dir CKPT/tokenizer --out DIR
 */
import { copyFileSync, linkSync, mkdirSync, existsSync, readFileSync, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const sha = (p) => new Promise((ok, no) => { const h = createHash('sha256'); createReadStream(p).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', no); });
const pinsPath = join(here, 'pins/laya-5766-fp32.pins.json');
const pins = JSON.parse(readFileSync(pinsPath, 'utf8'));
const out = resolve(arg('--out'));
mkdirSync(join(out, 'tokenizer'), { recursive: true });
const place = (src, dst) => { if (existsSync(dst)) return; try { linkSync(src, dst); } catch { copyFileSync(src, dst); } };
place(resolve(arg('--onnx')), join(out, 'laya.onnx'));
place(join(here, 'pins/laya_config.json'), join(out, 'laya_config.json'));
for (const f of ['tokenizer.json', 'tokenizer_config.json']) place(join(resolve(arg('--tokenizer-dir')), f), join(out, 'tokenizer', f));
const checks = [['laya.onnx', pins.onnx.sha256], ...Object.entries(pins.bundle)];
for (const [rel, want] of checks) {
  const got = await sha(join(out, rel));
  if (got !== want) { console.error(`SHA mismatch ${rel}: ${got} != ${want}`); process.exit(1); }
  console.error(`ok ${rel} ${got}`);
}
const config = {
  kind: 'local',
  engine: 'laya-onnx',
  modelPath: join(out, 'laya.onnx'),
  modelSha256: pins.onnx.sha256,
  laya: {
    pinsPath,
    pinsSha256: await sha(pinsPath),
    compositionPath: join(repo, pins.composition.file),
    compositionSha256: pins.composition.sha256,
    intraOpNumThreads: 8,
  },
  note: `${pins.name}. Non-default development path; omit this file for the rule evaluator.`,
};
console.log(JSON.stringify(config, null, 2));
