// SHA-256 pin of the on-device evaluator model.
//
// Paper: step 8. Provisional: Section 3.3 (reproducible verdicts).
// A verdict is only attributable if the evaluator that produced it is pinned. The digest is
// checked before the GGUF is loaded so a swapped file cannot silently produce findings.

import { closeSync, existsSync, openSync, readSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';

const CHUNK = 1024 * 1024;

export function normalizeDigest(hex: string): string {
  return hex.trim().toLowerCase().replace(/^sha-?256:/, '');
}

export function sha256FileHex(filePath: string): string {
  const hash = createHash('sha256');
  const fd = openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(CHUNK);
    let n = 0;
    while ((n = readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.subarray(0, n));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest('hex');
}

export function verifyModelSha256(filePath: string, expectedHex: string): string {
  if (!existsSync(filePath)) {
    throw new Error(
      `local evaluator model file not found (${basename(filePath)}). Run npm run fetch:evaluator-model`,
    );
  }
  const actual = sha256FileHex(filePath);
  const expected = normalizeDigest(expectedHex);
  if (actual !== expected) {
    throw new Error(
      `local evaluator model digest mismatch for ${basename(filePath)}: expected ${expected}, got ${actual}. ` +
        'A verdict is only attributable if the evaluator is pinned (provisional Section 3.3).',
    );
  }
  return actual;
}
