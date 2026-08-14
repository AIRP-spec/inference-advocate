#!/usr/bin/env node
// Fetch the pinned on-device evaluator model, verify SHA-256, then move it into place.
//
// Paper: step 8. Provisional: Section 3.3 (pinned, reproducible evaluator).
// The GGUF is not in git. This script is how a clone obtains the same bytes the tests pin.

import { createHash } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const modelsDir = join(repoRoot, 'data', 'models');
const manifestPath = join(modelsDir, 'manifest.json');

async function sha256File(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

async function download(url, dest, expectedSize) {
  const partial = `${dest}.partial`;
  const have = existsSync(partial) ? statSync(partial).size : 0;
  /** @type {Record<string, string>} */
  const headers = { 'user-agent': 'airp-fetch-evaluator-model' };
  if (have > 0) headers.Range = `bytes=${have}-`;

  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok && res.status !== 206) {
    throw new Error(`download failed: HTTP ${res.status}`);
  }

  const restart = have > 0 && res.status === 200;
  if (restart) console.log(`server ignored Range; restarting ${dest}`);
  else if (have > 0) console.log(`resuming at byte ${have}`);

  if (!res.body) throw new Error('download returned an empty body');
  await pipeline(
    Readable.fromWeb(res.body),
    createWriteStream(partial, { flags: restart || have === 0 ? 'w' : 'a' }),
  );

  const size = statSync(partial).size;
  if (expectedSize && size !== expectedSize) {
    throw new Error(`downloaded ${size} bytes, expected ${expectedSize}. Delete ${partial} and retry.`);
  }
  return partial;
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!manifest.sourceUrl || !manifest.fileName || !manifest.sha256) {
  throw new Error('data/models/manifest.json must name sourceUrl, fileName, and sha256');
}
mkdirSync(modelsDir, { recursive: true });
const dest = join(modelsDir, manifest.fileName);

if (existsSync(dest)) {
  const actual = await sha256File(dest);
  if (actual === manifest.sha256) {
    console.log(`already present and pinned: ${manifest.fileName}`);
    console.log(`sha256  ${actual}`);
    process.exit(0);
  }
  console.warn(`existing file digest ${actual} does not match pin ${manifest.sha256}; re-downloading`);
  unlinkSync(dest);
}

console.log(`fetching ${manifest.name} (${manifest.quantization})`);
console.log(`source   ${manifest.sourceUrl}`);
const partial = await download(manifest.sourceUrl, dest, manifest.bytes);
const actual = await sha256File(partial);
if (actual !== manifest.sha256) {
  unlinkSync(partial);
  throw new Error(`downloaded digest ${actual} does not match pin ${manifest.sha256}. Refusing to install.`);
}
renameSync(partial, dest);
console.log(`installed ${manifest.fileName}`);
console.log(`sha256    ${actual}`);
console.log(`prompt    ${manifest.promptTemplateVersion}`);
