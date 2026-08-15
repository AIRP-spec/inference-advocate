#!/usr/bin/env node
// Slot plan for the training generator. Counts come from recipe.json.
//
// Paper: step 8. Labels are a property of the slot, not a second model call.
// Dual-class slots are the published conjunction pairs, never bundles.
// Profanity and hate positive-singles are composed locally: the writer refuses
// those surface features, and the conformance screen is binary, so a refusal
// leaves the slot unfillable. CSE remains composedClass. Writer hard-negatives
// and writer multi-pairs are unchanged.
//
// Positive-single splits: when a class's published definition overlaps a
// neighbor on the content a positive would produce, the 80 singles are split
// by kind and the slot's expect is fixed to that kind. Violence-method is
// violence plus criminal_assistance because attack how-to independently meets
// both definitions. Self-harm method is self_harm only: criminal_assistance is
// concrete assistance for crimes against others or the state (fraud, theft,
// weapons, intrusion), and the accepted held-out method items are self_harm
// only. That decision is recorded on the recipe as
// methodMeetsCriminalAssistance: false. Do not infer a dual from the word
// "method" alone.

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

export function writerPositiveTypes(recipe, types) {
  const cse = recipe.composedClass;
  if (!cse) throw new Error('recipe.composedClass is required');
  const surface = new Set(composedSurfaceTypes(recipe));
  return types.filter((t) => t !== cse && !surface.has(t));
}

/**
 * Classes whose positive-singles are composed locally because the writer
 * refuses their surface features (expletives, slurs). CSE is composedClass,
 * not this list. Hard-negatives and writer multi-pairs are unaffected.
 *
 * @param {object} recipe
 * @returns {string[]}
 */
export function composedSurfaceTypes(recipe) {
  const extra = recipe.composedSurfaceClasses ?? [];
  if (!Array.isArray(extra)) throw new Error('composedSurfaceClasses must be an array');
  const cse = recipe.composedClass;
  const seen = new Set();
  for (const type of extra) {
    if (typeof type !== 'string' || type.length === 0) {
      throw new Error('composedSurfaceClasses has an empty entry');
    }
    if (type === cse) {
      throw new Error('composedSurfaceClasses must not include composedClass');
    }
    if (seen.has(type)) throw new Error(`duplicate composedSurfaceClass ${type}`);
    seen.add(type);
  }
  return extra;
}

/**
 * Preflight: every taxonomy class that has a positive path is writer or composed.
 *
 * @param {object} recipe
 * @param {string[]} types
 * @returns {Array<{ type: string, path: 'writer' | 'composed', family: string, count: number, dual: number }>}
 */
export function positivePathReport(recipe, types) {
  const writer = new Set(writerPositiveTypes(recipe, types));
  const surface = new Set(composedSurfaceTypes(recipe));
  const cse = recipe.composedClass;
  const c = recipe.counts.positive;
  /** @type {Array<{ type: string, path: 'writer' | 'composed', family: string, count: number, dual: number }>} */
  const rows = [];
  for (const type of types) {
    if (type === cse) {
      rows.push({
        type,
        path: 'composed',
        family: 'positive-composed',
        count: c.composedSingle,
        dual: c.composedDual,
      });
    } else if (surface.has(type)) {
      rows.push({
        type,
        path: 'composed',
        family: 'positive-composed',
        count: c.singlePerClass,
        dual: 0,
      });
    } else if (writer.has(type)) {
      rows.push({
        type,
        path: 'writer',
        family: 'positive-single',
        count: c.singlePerClass,
        dual: 0,
      });
    }
  }
  return rows;
}

/**
 * @param {object} recipe
 * @param {string} type
 */
export function positiveSingleKindsFor(recipe, type) {
  const split = recipe.positiveSingleSplits?.[type];
  if (!split) return null;
  if (!Array.isArray(split.kinds) || split.kinds.length === 0) {
    throw new Error(`positiveSingleSplits.${type} has no kinds`);
  }
  let sum = 0;
  const seen = new Set();
  for (const kind of split.kinds) {
    if (!kind.kind || typeof kind.kind !== 'string') {
      throw new Error(`positiveSingleSplits.${type} has a kind without a name`);
    }
    if (seen.has(kind.kind)) throw new Error(`duplicate kind ${kind.kind} on ${type}`);
    seen.add(kind.kind);
    if (!Number.isInteger(kind.count) || kind.count < 1) {
      throw new Error(`kind ${kind.kind} on ${type} has invalid count`);
    }
    if (!Array.isArray(kind.expect) || kind.expect.length === 0) {
      throw new Error(`kind ${kind.kind} on ${type} has empty expect`);
    }
    sum += kind.count;
  }
  const want = recipe.counts.positive.singlePerClass;
  if (sum !== want) {
    throw new Error(`split for ${type} sums to ${sum}, want ${want}`);
  }
  return split.kinds;
}

/**
 * @param {object} recipe
 * @param {string[]} types taxonomy types in order
 */
export function expectedTotal(recipe, types) {
  const c = recipe.counts;
  const harm = recipe.harmClasses.length;
  const writer = writerPositiveTypes(recipe, types).length;
  const surface = composedSurfaceTypes(recipe).length;
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
    c.positive.singlePerClass * writer +
    c.positive.multi +
    c.positive.composedSingle +
    c.positive.composedDual +
    c.positive.singlePerClass * surface
  );
}

/**
 * @param {object} recipe
 * @param {string[]} types
 * @returns {Array<{ id: string, family: string, class: string | null, expect: string[], pair?: string[], kind?: string }>}
 */
export function buildSlots(recipe, types) {
  const c = recipe.counts;
  /** @type {Array<{ id: string, family: string, class: string | null, expect: string[], pair?: string[], kind?: string }>} */
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
  const cse = recipe.composedClass;
  for (const type of writerPositiveTypes(recipe, types)) {
    const kinds = positiveSingleKindsFor(recipe, type);
    if (kinds) {
      for (const spec of kinds) {
        for (let i = 0; i < spec.count; i++) {
          add('positive-single', type, [...spec.expect], { kind: spec.kind });
        }
      }
    } else {
      for (let i = 0; i < c.positive.singlePerClass; i++) add('positive-single', type, [type]);
    }
  }
  for (let i = 0; i < c.positive.composedSingle; i++) {
    add('positive-composed', cse, [cse]);
  }
  const dualAlso = 'sexual_content';
  for (let i = 0; i < c.positive.composedDual; i++) {
    add('positive-composed', null, [cse, dualAlso], { pair: [cse, dualAlso] });
  }
  for (const type of composedSurfaceTypes(recipe)) {
    if (!types.includes(type)) throw new Error(`composed surface class ${type} is not in the taxonomy`);
    const scaffold = recipe.composedScaffolds?.[type];
    if (!scaffold) throw new Error(`no composedScaffolds path for ${type}`);
    for (let i = 0; i < c.positive.singlePerClass; i++) {
      add('positive-composed', type, [type]);
    }
  }
  const pairs = recipe.multiPairs;
  if (!Array.isArray(pairs) || pairs.length === 0) throw new Error('recipe.multiPairs is empty');
  for (const pair of pairs) {
    if (pair.includes(cse)) {
      throw new Error(
        'child_sexual_exploitation must not appear in multiPairs. Composed duals cover that conjunction.',
      );
    }
  }
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
