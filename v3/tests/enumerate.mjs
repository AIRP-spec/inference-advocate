// Exhaustively compose every (stance x 2^16 object/qualifier subset) and print one sha256 over all outputs.
// Usage: node tests/enumerate.mjs <module-with-compose.js> <composition.json>
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const STANCES = ['conveys_method', 'depicts', 'describes', 'encourages', 'endorses'];
const OBJECTS = ['violence_person', 'self_harm', 'sexual_activity', 'financial_crime', 'intrusion', 'weapons', 'profanity'];
const QUALIFIERS = ['targets_protected_characteristic', 'subject_is_minor', 'asserts_interior_state', 'addresses_own_nature',
  'explicit_register', 'exceeds_common_knowledge', 'is_mention_not_use', 'directed_at_user', 'untethered_to_content'];
const { compose } = await import(pathToFileURL(resolve(process.argv[2])).href);
const comp = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const h = createHash('sha256');
let n = 0, fired = 0;
for (const stance of STANCES) {
  for (let m = 0; m < 1 << 16; m++) {
    const objects = OBJECTS.filter((_, i) => m & (1 << i));
    const qualifiers = QUALIFIERS.filter((_, i) => m & (1 << (i + 7)));
    const got = compose({ stance, objects, qualifiers }, comp);
    if (got.length) fired++;
    h.update(`${stance}|${m}|${got.join(',')}\n`);
    n++;
  }
}
console.log(JSON.stringify({ n, fired, sha256: h.digest('hex') }));
