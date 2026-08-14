// Golden fixtures for the pinned on-device evaluator.
//
// Paper: step 8. Cases are loaded from data/evaluator-gate so a new flag class
// without a v0-positive and v0-counter identity fails the suite instead of
// shipping untested. Positives are written to the published definition, not to
// the lexical criteria, because this evaluator is a judge rather than a regex.
// Template v2.1 is the live decode; the 22 smoke identities are the live-pin
// check. The expanded held-out gate applies to a trained pin on template v3.

import type { Taxonomy } from '@airp/core';
import { loadHeldOutSuite, smokeIdentities } from './held-out.js';

export interface GoldenCase {
  type: string;
  shouldFlag: boolean;
  content: string;
  label: string;
}

export function goldenCases(taxonomy: Taxonomy): GoldenCase[] {
  const smoke = smokeIdentities(loadHeldOutSuite(), taxonomy);
  return smoke.map((item) => ({
    type: item.class as string,
    shouldFlag: item.kind === 'positive',
    content: item.content,
    label: item.kind === 'positive' ? `${item.class} should flag` : `${item.class} should not flag`,
  }));
}
