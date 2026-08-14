// Held-out certification suite loader and gate scoring.
//
// Paper: step 8. Provisional: Section 3.3.
// The suite is a versioned document under data/evaluator-gate, not constants
// in this file. The live pin still uses the 22 smoke identities. The full
// gate applies to a trained evaluator on template v3.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Taxonomy } from '@airp/core';
import { dataPath } from './helpers.js';

export const HELD_OUT_DIR = 'evaluator-gate';
export const HELD_OUT_SUITE_FILE = 'held-out-suite.v1.json';
export const HELD_OUT_GATE_FILE = 'gate.json';

export type HeldOutKind = 'positive' | 'counter' | 'boundary' | 'clean' | 'multi';
export type HeldOutOrigin = 'smoke-v0' | 'taxonomy-published' | 'held-out-v1';

export interface HeldOutItem {
  id: string;
  kind: HeldOutKind;
  class: string | null;
  origin: HeldOutOrigin;
  family: string;
  prompt?: string;
  content: string;
  expect: string[];
  notes?: string;
  boundary?: 'over' | 'under';
}

export interface HeldOutSuite {
  suiteVersion: string;
  schemaVersion: number;
  taxonomyVersion: string;
  status: string;
  created: string;
  paper: string;
  notes: string;
  generation: { method: string; date: string; note: string };
  review: { status: string; reviewer: string; note: string };
  items: HeldOutItem[];
}

export interface GateConfig {
  gateVersion: string;
  paper: string;
  taxonomyVersion: string;
  suiteFile: string;
  suiteSha256: string;
  appliesWhen: { promptTemplateVersion: string; note: string };
  rules: {
    everyItemFiresItsExpectedClasses: { gating: boolean; definition: string };
    maxSuiteExtraClassFires: { gating: boolean; value: number; definition: string };
  };
  wallTime: {
    gating: boolean;
    report: string[];
    hardwareStatementRequired: boolean;
    targetNote: string;
  };
}

export interface ItemVerdict {
  id: string;
  got: string[];
  ms: number;
}

export interface GateItemResult {
  id: string;
  kind: HeldOutKind;
  missing: string[];
  extra: string[];
  pass: boolean;
  ms: number;
}

export interface GateScore {
  pass: boolean;
  n: number;
  recallFailures: GateItemResult[];
  extraClassFires: number;
  extraLimit: number;
  precisionPass: boolean;
  meanMs: number;
  meanCleanPathMs: number | null;
  meanFirePathMs: number | null;
  rows: GateItemResult[];
}

const KINDS: ReadonlySet<string> = new Set(['positive', 'counter', 'boundary', 'clean', 'multi']);
const ORIGINS: ReadonlySet<string> = new Set(['smoke-v0', 'taxonomy-published', 'held-out-v1']);

export function heldOutSuitePath(): string {
  return dataPath(HELD_OUT_DIR, HELD_OUT_SUITE_FILE);
}

export function heldOutGatePath(): string {
  return dataPath(HELD_OUT_DIR, HELD_OUT_GATE_FILE);
}

export function sha256FileHex(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function loadHeldOutSuite(): HeldOutSuite {
  const raw = JSON.parse(readFileSync(heldOutSuitePath(), 'utf8')) as HeldOutSuite;
  if (raw.schemaVersion !== 1) {
    throw new Error(`held-out suite schemaVersion ${raw.schemaVersion} is not 1`);
  }
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    throw new Error('held-out suite has no items');
  }
  const ids = new Set<string>();
  for (const item of raw.items) {
    if (!item.id) throw new Error('held-out item missing id');
    if (ids.has(item.id)) throw new Error(`duplicate held-out id ${item.id}`);
    ids.add(item.id);
    if (!KINDS.has(item.kind)) throw new Error(`${item.id} has unknown kind ${item.kind}`);
    if (!ORIGINS.has(item.origin)) throw new Error(`${item.id} has unknown origin ${item.origin}`);
    if (typeof item.content !== 'string' || item.content.length === 0) {
      throw new Error(`${item.id} has empty content`);
    }
    if (!Array.isArray(item.expect)) throw new Error(`${item.id} missing expect`);
  }
  return raw;
}

export function loadGateConfig(): GateConfig {
  return JSON.parse(readFileSync(heldOutGatePath(), 'utf8')) as GateConfig;
}

/**
 * Smoke identities: one positive and one counter per taxonomy class, in taxonomy
 * order. These are the original 22. A new class without both identities fails
 * here instead of shipping untested.
 */
export function smokeIdentities(suite: HeldOutSuite, taxonomy: Taxonomy): HeldOutItem[] {
  const byId = new Map(suite.items.map((item) => [item.id, item]));
  const missing: string[] = [];
  const out: HeldOutItem[] = [];
  for (const def of taxonomy.flags) {
    const positive = byId.get(`v0-positive-${def.type}`);
    if (!positive) missing.push(`${def.type} (no v0-positive identity)`);
    else out.push(positive);
    const counter = byId.get(`v0-counter-${def.type}`);
    if (!counter) missing.push(`${def.type} (no v0-counter identity)`);
    else out.push(counter);
  }
  if (missing.length > 0) {
    throw new Error(
      `held-out suite does not cover the current taxonomy: ${missing.join('; ')}. ` +
        'Add a v0-positive and v0-counter identity in the suite, and a counter-example in the taxonomy file.',
    );
  }
  return out;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Score a model run against gate.json. Used by the v3 pin test and unit-tested with fixtures. */
export function scoreHeldOutGate(
  suite: HeldOutSuite,
  gate: GateConfig,
  verdicts: ItemVerdict[],
): GateScore {
  const byId = new Map(verdicts.map((v) => [v.id, v]));
  const rows: GateItemResult[] = [];
  let extraClassFires = 0;
  const cleanMs: number[] = [];
  const fireMs: number[] = [];
  const allMs: number[] = [];

  for (const item of suite.items) {
    const v = byId.get(item.id);
    if (!v) {
      throw new Error(`gate scoring missing verdict for ${item.id}`);
    }
    const missing = item.expect.filter((type) => !v.got.includes(type));
    const extra = v.got.filter((type) => !item.expect.includes(type));
    extraClassFires += extra.length;
    allMs.push(v.ms);
    if (item.expect.length === 0) cleanMs.push(v.ms);
    else fireMs.push(v.ms);
    rows.push({
      id: item.id,
      kind: item.kind,
      missing,
      extra,
      pass: missing.length === 0 && extra.length === 0,
      ms: v.ms,
    });
  }

  const recallFailures = rows.filter((r) => r.missing.length > 0);
  const extraLimit = gate.rules.maxSuiteExtraClassFires.value;
  const precisionPass = extraClassFires <= extraLimit;
  const recallGating = gate.rules.everyItemFiresItsExpectedClasses.gating;
  const precisionGating = gate.rules.maxSuiteExtraClassFires.gating;
  const pass =
    (!recallGating || recallFailures.length === 0) && (!precisionGating || precisionPass);

  return {
    pass,
    n: rows.length,
    recallFailures,
    extraClassFires,
    extraLimit,
    precisionPass,
    meanMs: mean(allMs) ?? 0,
    meanCleanPathMs: mean(cleanMs),
    meanFirePathMs: mean(fireMs),
    rows,
  };
}
