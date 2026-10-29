/**
 * Composition layer for primitives evaluator.
 * 
 * Paper: step 8. Provisional Section 3.3.
 * 
 * This module provides a thin CLI/wrapper that imports the shared compose function
 * from @airp/evaluator-local. The composition logic lives in a single place to prevent
 * divergence between runtime (LocalEvaluator) and build tools.
 * 
 * Single source of truth: packages/evaluator-local/src/compose-primitives.ts
 */

import fs from "node:fs";
import { compose as composeCore } from "@airp/evaluator-local";

/**
 * Load composition rules from a JSON file.
 */
export function loadComposition(compositionPath) {
  return JSON.parse(fs.readFileSync(compositionPath, "utf-8"));
}

/**
 * Compose primitives into taxonomy verdicts.
 * 
 * This is a wrapper around the shared compose function that handles file path loading.
 * 
 * @param {Object} primitives - { stance: string, objects: string[], qualifiers: string[] }
 * @param {Object|string} composition - Composition object or path to composition JSON file
 * @returns {string[]} - Array of fired class names
 */
export function compose(primitives, composition) {
  // Load composition if path provided
  if (typeof composition === "string") {
    composition = loadComposition(composition);
  }
  refuseHostCompositionWithoutHost(composition);

  return composeCore(primitives, composition);
}

/**
 * Host-attested inputs (compositions that declare `hostInputs`, e.g. ny-s9051-v1.json).
 *
 * A host input is a fact the host attests and the model never predicts (who the user is, not what the
 * text says). The composition references it as a pseudo-qualifier named `host.<name>` so the shared
 * compose core evaluates it with no runtime change. Three guards keep it a host fact:
 * - compose()/composeBatch() refuse a composition that declares hostInputs: a missing attestation must
 *   be an error, never a silent "not in scope".
 * - composeWithHost() requires every declared input as a boolean and rejects undeclared keys.
 * - any `host.`-prefixed qualifier arriving in the model's primitives is stripped before injection.
 */
export const HOST_PREFIX = "host.";

function refuseHostCompositionWithoutHost(composition) {
  if (Array.isArray(composition.hostInputs) && composition.hostInputs.length > 0) {
    throw new Error(
      `composition ${composition.compositionVersion} declares hostInputs (${composition.hostInputs.map((h) => h.name).join(", ")}); use composeWithHost()`
    );
  }
}

export function composeWithHost(primitives, composition, host) {
  if (typeof composition === "string") {
    composition = loadComposition(composition);
  }
  const declared = (composition.hostInputs || []).map((h) => h.name);
  if (declared.length === 0) {
    throw new Error(`composition ${composition.compositionVersion} declares no hostInputs; use compose()`);
  }
  if (!host || typeof host !== "object") {
    throw new Error("composeWithHost() needs a host attestation object");
  }
  for (const key of Object.keys(host)) {
    if (!declared.includes(key)) throw new Error(`undeclared host input ${key}`);
  }
  for (const name of declared) {
    if (typeof host[name] !== "boolean") throw new Error(`host input ${name} must be attested as a boolean`);
  }
  const qualifiers = (primitives.qualifiers || []).filter((q) => !q.startsWith(HOST_PREFIX));
  for (const name of declared) if (host[name]) qualifiers.push(name);
  return composeCore(
    { stance: primitives.stance, objects: primitives.objects || [], qualifiers },
    composition
  );
}

const SUPPORT_LEVELS = new Set(["covered", "partial", "host-evidence", "pending-regulation"]);

function collectAtoms(cond, out) {
  if (!cond) return out;
  if (cond.stance) out.stance.add(cond.stance);
  for (const o of cond.objects || []) out.objects.add(o);
  for (const q of cond.qualifiers || []) out.qualifiers.add(q);
  for (const c of cond.allOf || []) collectAtoms(c, out);
  for (const c of cond.anyOf || []) collectAtoms(c, out);
  return out;
}

/**
 * Validate a composition against the primitive vocabulary. Returns a list of problems (empty = valid).
 * Every stance/object/qualifier a rule references must be in the vocabulary, or be a declared host input.
 * Compositions that use `support` (ny-s9051-v1) must also: cite a subsection per class, give every
 * partial class its missingPrimitives, give host-evidence and pending-regulation classes a null rule,
 * and gate every non-null rule on every required host input. A host input with `scope` (a list of class ids) gates
 * only those classes; rules outside its scope must not reference it.
 */
export function validateComposition(composition, vocabulary) {
  const problems = [];
  const vocab = vocabulary.primitives;
  const names = (g) => new Set(vocab[g].map((p) => p.primitive));
  const stances = names("stance");
  const objects = names("object");
  const quals = names("qualifiers");
  const hostNames = new Set((composition.hostInputs || []).map((h) => h.name));
  for (const h of hostNames) {
    if (!h.startsWith(HOST_PREFIX)) problems.push(`host input ${h} must start with ${HOST_PREFIX}`);
    if (quals.has(h)) problems.push(`host input ${h} collides with a model primitive`);
  }
  const seen = new Set();
  const usesSupport = composition.classes.some((c) => c.support !== undefined);
  for (const c of composition.classes) {
    if (seen.has(c.class)) problems.push(`duplicate class ${c.class}`);
    seen.add(c.class);
    const atoms = collectAtoms(c.rule, { stance: new Set(), objects: new Set(), qualifiers: new Set() });
    for (const s of atoms.stance) if (!stances.has(s)) problems.push(`${c.class}: unknown stance ${s}`);
    for (const o of atoms.objects) if (!objects.has(o)) problems.push(`${c.class}: unknown object ${o}`);
    for (const q of atoms.qualifiers) if (!quals.has(q) && !hostNames.has(q)) problems.push(`${c.class}: unknown qualifier ${q}`);
    if (!usesSupport) continue;
    if (!SUPPORT_LEVELS.has(c.support)) problems.push(`${c.class}: support must be one of ${[...SUPPORT_LEVELS].join(", ")}`);
    if (!c.citation) problems.push(`${c.class}: missing citation`);
    if (c.support === "partial" && !(c.missingPrimitives || []).length) problems.push(`${c.class}: partial without missingPrimitives`);
    if ((c.support === "host-evidence" || c.support === "pending-regulation") && c.rule !== null) {
      problems.push(`${c.class}: ${c.support} must have rule null`);
    }
    if (c.support === "covered" && !c.rule) problems.push(`${c.class}: covered without a rule`);
    if (c.rule) {
      const top = c.rule.allOf || [];
      for (const h of composition.hostInputs || []) {
        if (!h.required) continue;
        if (Array.isArray(h.scope) && !h.scope.includes(c.class)) {
          // Scoped host input (ca-sb243-v1: host.known_minor gates only the § 22602(c) units): out-of-scope rules must not use it.
          const used = collectAtoms(c.rule, { stance: new Set(), objects: new Set(), qualifiers: new Set() }).qualifiers.has(h.name);
          if (used) problems.push(`${c.class}: uses host input ${h.name} outside its declared scope`);
          continue;
        }
        const gated = top.some((t) => (t.qualifiers || []).includes(h.name) && !t.anyOf && !t.allOf);
        if (!gated) problems.push(`${c.class}: rule is not gated on required host input ${h.name}`);
      }
    }
  }
  for (const h of composition.hostInputs || []) {
    for (const id of Array.isArray(h.scope) ? h.scope : []) {
      if (!seen.has(id)) problems.push(`host input ${h.name} scope names unknown class ${id}`);
    }
  }
  for (const h of hostNames) {
    if (composition.classes.some((c) => c.rule && collectAtoms(c.rule, { stance: new Set(), objects: new Set(), qualifiers: new Set() }).qualifiers.has(h)) === false) {
      problems.push(`host input ${h} is declared but no rule uses it`);
    }
  }
  return problems;
}

/**
 * Compose a batch of primitive rows.
 * 
 * @param {Array} primitiveRows - Array of { id, stance, objects, qualifiers, ... }
 * @param {Object|string} composition - Composition object or path
 * @returns {Array} - Array of { id, verdicts: string[] }
 */
export function composeBatch(primitiveRows, composition) {
  // Load composition once if path provided
  if (typeof composition === "string") {
    composition = loadComposition(composition);
  }
  refuseHostCompositionWithoutHost(composition);

  return primitiveRows.map((row) => ({
    id: row.id,
    verdicts: composeCore(
      {
        stance: row.stance,
        objects: row.objects || [],
        qualifiers: row.qualifiers || [],
      },
      composition
    ),
  }));
}
