// Test-side wrappers: default paths into data/evaluator-gate/.
//
// Paper: step 8. Provisional: Section 3.3.
// Scoring and suite loading live in src/held-out-gate.ts so the training
// harness and these tests cannot drift.

import { dataPath } from './helpers.js';
import {
  HELD_OUT_GATE_FILE,
  HELD_OUT_SUITE_FILE,
  loadGateConfigFromFile,
  loadHeldOutSuiteFromFile,
  mean,
  scoreHeldOutGate,
  sha256FileHex,
  smokeIdentities,
  type GateConfig,
  type GateItemResult,
  type GateScore,
  type HeldOutItem,
  type HeldOutKind,
  type HeldOutOrigin,
  type HeldOutSuite,
  type ItemVerdict,
} from '@airp/evaluator-local';

export const HELD_OUT_DIR = 'evaluator-gate';
export { HELD_OUT_GATE_FILE, HELD_OUT_SUITE_FILE };
export type {
  GateConfig,
  GateItemResult,
  GateScore,
  HeldOutItem,
  HeldOutKind,
  HeldOutOrigin,
  HeldOutSuite,
  ItemVerdict,
};
export { mean, scoreHeldOutGate, sha256FileHex, smokeIdentities };

export function heldOutSuitePath(): string {
  return dataPath(HELD_OUT_DIR, HELD_OUT_SUITE_FILE);
}

export function heldOutGatePath(): string {
  return dataPath(HELD_OUT_DIR, HELD_OUT_GATE_FILE);
}

export function loadHeldOutSuite(): HeldOutSuite {
  return loadHeldOutSuiteFromFile(heldOutSuitePath());
}

export function loadGateConfig(): GateConfig {
  return loadGateConfigFromFile(heldOutGatePath());
}
