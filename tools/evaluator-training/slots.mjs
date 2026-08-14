#!/usr/bin/env node
// Slot plan for the training generator. Counts come from recipe.json.
//
// Paper: step 8. Labels are a property of the slot, not a second model call.
// Dual-class slots are the published conjunction pairs, never bundles.

/**
 * @param {number} seed
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @template T
 * @param {T[]} arr
 * @param {() => number} rng
 */
export function shuffle(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * @param {object} recipe
 * @param {string[]} types taxonomy types in order
 */
export function expectedTotal(recipe, types) {
  const c = recipe.counts;
  const harm = recipe.harmClasses.length;
  return (
    c.clean.greeting +
    c.clean.fact +
    c.clean.helpful +
    c.clean.refusal +
    c.clean['crisis-redirect'] +
    c.hardNegative.mentionVersusUsePerClass * types.length +
    c.hardNegative.classRefusalPerClass * types.length +
    c.hardNegative.denialPersona +
    c.hardNegative.denialMachine +
    c.hardNegative.sensitiveDiscussionPerHarmClass * harm +
    c.positive.singlePerClass * types.length +
    c.positive.multi
  );
}

/**
 * @param {object} recipe
 * @param {string[]} types
 * @returns {Array<{ id: string, family: string, class: string | null, expect: string[], pair?: string[] }>}
 */
export function buildSlots(recipe, types) {
  const c = recipe.counts;
  /** @type {Array<{ id: string, family: string, class: string | null, expect: string[], pair?: string[] }>} */
  const slots = [];
  let n = 0;
  const add = (family, klass, expect, extra = {}) => {
    n += 1;
    slots.push({
      id: `tr-${family}-${String(n).padStart(4, '0')}`,
      family,
      class: klass,
      expect,
      ...extra,
    });
  };

  for (let i = 0; i < c.clean.greeting; i++) add('greeting', null, []);
  for (let i = 0; i < c.clean.fact; i++) add('fact', null, []);
  for (let i = 0; i < c.clean.helpful; i++) add('helpful', null, []);
  for (let i = 0; i < c.clean.refusal; i++) add('refusal', null, []);
  for (let i = 0; i < c.clean['crisis-redirect']; i++) add('crisis-redirect', null, []);

  for (const type of types) {
    for (let i = 0; i < c.hardNegative.mentionVersusUsePerClass; i++) {
      add('mention-versus-use', type, []);
    }
    for (let i = 0; i < c.hardNegative.classRefusalPerClass; i++) {
      add('class-refusal', type, []);
    }
  }
  for (let i = 0; i < c.hardNegative.denialPersona; i++) add('denial-persona', 'persona_claims', []);
  for (let i = 0; i < c.hardNegative.denialMachine; i++) {
    add('denial-machine', 'simulation_obscured', []);
  }
  for (const type of recipe.harmClasses) {
    if (!types.includes(type)) throw new Error(`harm class ${type} is not in the taxonomy`);
    for (let i = 0; i < c.hardNegative.sensitiveDiscussionPerHarmClass; i++) {
      add('sensitive-discussion', type, []);
    }
  }
  for (const type of types) {
    for (let i = 0; i < c.positive.singlePerClass; i++) add('positive-single', type, [type]);
  }
  const pairs = recipe.multiPairs;
  if (!Array.isArray(pairs) || pairs.length === 0) throw new Error('recipe.multiPairs is empty');
  for (let i = 0; i < c.positive.multi; i++) {
    const pair = pairs[i % pairs.length];
    add('positive-multi', null, [...pair], { pair });
  }

  const total = expectedTotal(recipe, types);
  if (slots.length !== total) {
    throw new Error(`slot count ${slots.length} != expected ${total}`);
  }
  return slots;
}
