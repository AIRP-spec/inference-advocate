#!/usr/bin/env node
// Slot plan for the training generator. Counts come from recipe.json.
//
// Paper: step 8. Labels are a property of the slot, not a second model call.
// Dual-class slots are the published conjunction pairs, never bundles.
// Contrastive triples and minimal pairs are composed locally from committed
// scaffolds: the deciding feature is the slot spec. Profanity and hate
// positive-singles are composed locally: the writer refuses those surface
// features, and the conformance screen is binary, so a refusal leaves the
// slot unfillable. CSE remains composedClass, split by minor-signal form,
// plus a CSE-alone framing slice that does not depict the act. Extra
// violence-conjunction how-to is composed. Writer hard-negatives and writer
// multi-pairs are unchanged.
//
// Positive-single splits: a class may split its positives by kind. Kinds no
// longer have to sum to singlePerClass. Volume follows register coverage: each
// kind is a register or a published-definition slice, and the kind's count is
// the learnable population for that register. path writer sends the kind to
// the generator; path composed fills it from a local scaffold because the
// writer sanitizes that register. Violence-method is violence plus
// criminal_assistance because attack how-to independently meets both
// definitions. Depiction and method have no register field: they are
// definition slices (labels change), not stylistic width. Self-harm
// encouragement is a register. Self-harm method is self_harm only:
// criminal_assistance is concrete assistance for crimes against others or
// the state (fraud, theft, weapons, intrusion), and the accepted held-out
// method items are self_harm only. That decision is recorded on the recipe as
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
 * @param {{ path?: string }} spec
 */
export function kindPath(spec) {
  const path = spec.path ?? 'writer';
  if (path !== 'writer' && path !== 'composed') {
    throw new Error(`kind path must be writer or composed, got ${path}`);
  }
  return path;
}

/**
 * @param {object} recipe
 * @param {string} type
 * @returns {number}
 */
export function positiveCountForType(recipe, type) {
  const kinds = positiveSingleKindsFor(recipe, type);
  if (!kinds) return recipe.counts.positive.singlePerClass;
  return kinds.reduce((sum, spec) => sum + spec.count, 0);
}

/**
 * @param {object} recipe
 * @param {string[]} types
 * @returns {number}
 */
export function writerSingleCount(recipe, types) {
  let n = 0;
  for (const type of writerPositiveTypes(recipe, types)) {
    const kinds = positiveSingleKindsFor(recipe, type);
    if (!kinds) {
      n += recipe.counts.positive.singlePerClass;
      continue;
    }
    for (const spec of kinds) {
      if (kindPath(spec) === 'writer') n += spec.count;
    }
  }
  return n;
}

/**
 * Composed register kinds on otherwise-writer classes (blunt formation,
 * imperative self-harm, crude sexual_content). Not CSE, not surface classes.
 *
 * @param {object} recipe
 * @param {string[]} types
 * @returns {number}
 */
export function composedRegisterCount(recipe, types) {
  let n = 0;
  for (const type of writerPositiveTypes(recipe, types)) {
    const kinds = positiveSingleKindsFor(recipe, type);
    if (!kinds) continue;
    for (const spec of kinds) {
      if (kindPath(spec) === 'composed') n += spec.count;
    }
  }
  return n;
}

/**
 * @param {object} recipe
 * @param {string[]} types
 * @returns {number}
 */
export function hardNegativeBoostTotal(recipe, types) {
  const boosts = recipe.hardNegativeBoosts ?? {};
  let n = 0;
  for (const [type, spec] of Object.entries(boosts)) {
    if (!types.includes(type)) throw new Error(`hardNegativeBoosts type ${type} is not in the taxonomy`);
    n += spec.mentionVersusUse ?? 0;
    n += spec.classRefusal ?? 0;
  }
  return n;
}

/**
 * Preflight: every taxonomy class that has a positive path is writer, composed,
 * or mixed (some kinds writer, some composed).
 *
 * @param {object} recipe
 * @param {string[]} types
 * @returns {Array<{ type: string, path: 'writer' | 'composed' | 'mixed', family: string, count: number, dual: number, writer?: number, composed?: number }>}
 */
export function positivePathReport(recipe, types) {
  const writer = new Set(writerPositiveTypes(recipe, types));
  const surface = new Set(composedSurfaceTypes(recipe));
  const cse = recipe.composedClass;
  const c = recipe.counts.positive;
  /** @type {Array<{ type: string, path: 'writer' | 'composed' | 'mixed', family: string, count: number, dual: number, writer?: number, composed?: number }>} */
  const rows = [];
  for (const type of types) {
    if (type === cse) {
      const kinds = composedClassKindsFor(recipe);
      if (kinds) {
        let single = 0;
        let dual = 0;
        for (const spec of kinds) {
          if (spec.expect.length > 1) dual += spec.count;
          else single += spec.count;
        }
        rows.push({
          type,
          path: 'composed',
          family: 'positive-composed',
          count: single,
          dual,
        });
      } else {
        rows.push({
          type,
          path: 'composed',
          family: 'positive-composed',
          count: c.composedSingle,
          dual: c.composedDual,
        });
      }
    } else if (surface.has(type)) {
      rows.push({
        type,
        path: 'composed',
        family: 'positive-composed',
        count: c.singlePerClass,
        dual: 0,
      });
    } else if (writer.has(type)) {
      const kinds = positiveSingleKindsFor(recipe, type);
      if (kinds) {
        let writerN = 0;
        let composedN = 0;
        for (const spec of kinds) {
          if (kindPath(spec) === 'composed') composedN += spec.count;
          else writerN += spec.count;
        }
        const path = writerN && composedN ? 'mixed' : composedN ? 'composed' : 'writer';
        rows.push({
          type,
          path,
          family: path === 'composed' ? 'positive-composed' : 'positive-single',
          count: writerN + composedN,
          dual: 0,
          writer: writerN,
          composed: composedN,
        });
      } else {
        rows.push({
          type,
          path: 'writer',
          family: 'positive-single',
          count: c.singlePerClass,
          dual: 0,
        });
      }
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
    const path = kindPath(kind);
    if (path === 'composed') {
      const rel = recipe.composedRegisterScaffolds?.[type];
      if (!rel) {
        throw new Error(
          `kind ${kind.kind} is composed but composedRegisterScaffolds has no path for ${type}`,
        );
      }
    }
  }
  return split.kinds;
}

/**
 * CSE composed kinds. Replaces flat composedSingle plus composedDual counts.
 * Every kind is composed. Expect always includes composedClass.
 *
 * @param {object} recipe
 */
export function composedClassKindsFor(recipe) {
  const split = recipe.composedClassSplits;
  if (!split) return null;
  if (!Array.isArray(split.kinds) || split.kinds.length === 0) {
    throw new Error('composedClassSplits has no kinds');
  }
  const cse = recipe.composedClass;
  const seen = new Set();
  const forms = new Set();
  for (const kind of split.kinds) {
    if (!kind.kind || typeof kind.kind !== 'string') {
      throw new Error('composedClassSplits has a kind without a name');
    }
    if (seen.has(kind.kind)) throw new Error(`duplicate composedClass kind ${kind.kind}`);
    seen.add(kind.kind);
    if (!Number.isInteger(kind.count) || kind.count < 1) {
      throw new Error(`composedClass kind ${kind.kind} has invalid count`);
    }
    if (!Array.isArray(kind.expect) || !kind.expect.includes(cse)) {
      throw new Error(`composedClass kind ${kind.kind} must expect ${cse}`);
    }
    if (kind.path && kind.path !== 'composed') {
      throw new Error(`composedClass kind ${kind.kind} must be composed`);
    }
    if (!kind.form || typeof kind.form !== 'string') {
      throw new Error(`composedClass kind ${kind.kind} has no form`);
    }
    forms.add(kind.form);
  }
  for (const required of ['numeric-age', 'minor-noun', 'school-grade', 'roleplay', 'age-marker']) {
    if (!forms.has(required)) {
      throw new Error(`composedClassSplits missing minor-signal form ${required}`);
    }
  }
  return split.kinds;
}

/**
 * @param {object} recipe
 * @returns {number}
 */
export function composedClassCount(recipe) {
  const kinds = composedClassKindsFor(recipe);
  if (kinds) return kinds.reduce((sum, spec) => sum + spec.count, 0);
  const c = recipe.counts.positive;
  return c.composedSingle + c.composedDual;
}

/**
 * Locked contrastive pairs and triples. Each group is count times arms.
 * Labels and the deciding feature come from the group spec, not the writer.
 *
 * @param {object} recipe
 */
export function contrastGroupsFor(recipe) {
  const spec = recipe.composedContrasts;
  if (!spec) return [];
  if (!Array.isArray(spec.groups) || spec.groups.length === 0) {
    throw new Error('composedContrasts has no groups');
  }
  const seen = new Set();
  const kindSeen = new Set();
  for (const group of spec.groups) {
    if (!group.id || typeof group.id !== 'string') {
      throw new Error('composedContrasts group has no id');
    }
    if (seen.has(group.id)) throw new Error(`duplicate contrast group ${group.id}`);
    seen.add(group.id);
    if (!Number.isInteger(group.count) || group.count < 1) {
      throw new Error(`contrast group ${group.id} has invalid count`);
    }
    if (!group.scaffold || typeof group.scaffold !== 'string') {
      throw new Error(`contrast group ${group.id} has no scaffold`);
    }
    if (!Array.isArray(group.arms) || group.arms.length === 0) {
      throw new Error(`contrast group ${group.id} has no arms`);
    }
    if (!group.decidingFeature || typeof group.decidingFeature !== 'string') {
      throw new Error(`contrast group ${group.id} has no decidingFeature`);
    }
    for (const arm of group.arms) {
      if (!arm.kind || typeof arm.kind !== 'string') {
        throw new Error(`contrast group ${group.id} arm has no kind`);
      }
      if (!arm.arm || typeof arm.arm !== 'string') {
        throw new Error(`contrast kind ${arm.kind} has no arm name`);
      }
      if (kindSeen.has(arm.kind)) throw new Error(`duplicate contrast kind ${arm.kind}`);
      kindSeen.add(arm.kind);
      if (!Array.isArray(arm.expect)) {
        throw new Error(`contrast kind ${arm.kind} has no expect`);
      }
    }
  }
  return spec.groups;
}

/**
 * @param {object} recipe
 * @returns {number}
 */
export function contrastCount(recipe) {
  let n = 0;
  for (const group of contrastGroupsFor(recipe)) {
    n += group.count * group.arms.length;
  }
  return n;
}

/**
 * @param {object} recipe
 * @param {string[]} types taxonomy types in order
 */
export function expectedTotal(recipe, types) {
  const c = recipe.counts;
  const harm = recipe.harmClasses.length;
  const surface = composedSurfaceTypes(recipe).length;
  return (
    c.clean.greeting +
    c.clean.fact +
    c.clean.helpful +
    c.clean.refusal +
    c.clean['crisis-redirect'] +
    c.hardNegative.mentionVersusUsePerClass * types.length +
    c.hardNegative.classRefusalPerClass * types.length +
    hardNegativeBoostTotal(recipe, types) +
    c.hardNegative.denialPersona +
    c.hardNegative.denialMachine +
    c.hardNegative.sensitiveDiscussionPerHarmClass * harm +
    writerSingleCount(recipe, types) +
    composedRegisterCount(recipe, types) +
    c.positive.multi +
    composedClassCount(recipe) +
    c.positive.singlePerClass * surface +
    contrastCount(recipe)
  );
}

/**
 * @param {object} recipe
 * @param {string[]} types
 * @returns {Array<{ id: string, family: string, class: string | null, expect: string[], pair?: string[], kind?: string, register?: string, path?: string }>}
 */
export function buildSlots(recipe, types) {
  const c = recipe.counts;
  /** @type {Array<{ id: string, family: string, class: string | null, expect: string[], pair?: string[], kind?: string, register?: string, path?: string }>} */
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

  const boosts = recipe.hardNegativeBoosts ?? {};
  for (const type of types) {
    const mention = c.hardNegative.mentionVersusUsePerClass + (boosts[type]?.mentionVersusUse ?? 0);
    const refusal = c.hardNegative.classRefusalPerClass + (boosts[type]?.classRefusal ?? 0);
    for (let i = 0; i < mention; i++) add('mention-versus-use', type, []);
    for (let i = 0; i < refusal; i++) add('class-refusal', type, []);
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
        const path = kindPath(spec);
        const family = path === 'composed' ? 'positive-composed' : 'positive-single';
        const extra = { kind: spec.kind, path };
        if (spec.register) extra.register = spec.register;
        for (let i = 0; i < spec.count; i++) {
          add(family, type, [...spec.expect], extra);
        }
      }
    } else {
      for (let i = 0; i < c.positive.singlePerClass; i++) add('positive-single', type, [type]);
    }
  }
  const cseKinds = composedClassKindsFor(recipe);
  if (cseKinds) {
    for (const spec of cseKinds) {
      const extra = { kind: spec.kind, path: 'composed', form: spec.form };
      if (spec.expect.length > 1) extra.pair = [...spec.expect];
      for (let i = 0; i < spec.count; i++) {
        add('positive-composed', cse, [...spec.expect], extra);
      }
    }
  } else {
    for (let i = 0; i < c.positive.composedSingle; i++) {
      add('positive-composed', cse, [cse]);
    }
    const dualAlso = 'sexual_content';
    for (let i = 0; i < c.positive.composedDual; i++) {
      add('positive-composed', null, [cse, dualAlso], { pair: [cse, dualAlso] });
    }
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
  for (const group of contrastGroupsFor(recipe)) {
    for (const arm of group.arms) {
      const extra = {
        kind: arm.kind,
        path: 'composed',
        contrastGroup: group.id,
        arm: arm.arm,
      };
      if (arm.form) extra.form = arm.form;
      if (arm.expect.length > 1) extra.pair = [...arm.expect];
      const family = arm.family ?? 'positive-composed';
      const klass = Object.prototype.hasOwnProperty.call(arm, 'class')
        ? arm.class
        : (arm.expect[0] ?? null);
      for (let i = 0; i < group.count; i++) {
        add(family, klass, [...arm.expect], extra);
      }
    }
  }

  const total = expectedTotal(recipe, types);
  if (slots.length !== total) {
    throw new Error(`slot count ${slots.length} != expected ${total}`);
  }
  return slots;
}
