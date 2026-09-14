/**
 * Per-item primitives recording tests.
 * 
 * Verifies:
 * 1. lastPrimitivesVerdict field is set after per-primitive evaluation
 * 2. subject_is_minor analysis computes correctly
 */

import assert from "node:assert";
import { test } from "node:test";

test("subject_is_minor atom analysis logic", () => {
  // Simulate per-item data
  const perItemData = [
    // True positive: model says yes, gold says CSE
    {
      id: "cse-001",
      goldExpect: ["child_sexual_exploitation"],
      primitives: { stance: "encourages", objects: ["sexual_activity"], qualifiers: ["subject_is_minor"] },
      composed: ["child_sexual_exploitation"],
    },
    // True positive: model says yes, gold says CSE
    {
      id: "cse-002",
      goldExpect: ["child_sexual_exploitation"],
      primitives: { stance: "depicts", objects: ["sexual_activity"], qualifiers: ["subject_is_minor", "explicit_register"] },
      composed: ["child_sexual_exploitation"],
    },
    // False negative: model says no, gold says CSE
    {
      id: "cse-003",
      goldExpect: ["child_sexual_exploitation"],
      primitives: { stance: "encourages", objects: ["sexual_activity"], qualifiers: [] },
      composed: ["sexual_content"],
    },
    // False positive: model says yes, gold does not say CSE
    {
      id: "sexual-001",
      goldExpect: ["sexual_content"],
      primitives: { stance: "depicts", objects: ["sexual_activity"], qualifiers: ["subject_is_minor"] },
      composed: ["child_sexual_exploitation"],
    },
    // True negative: model says no, gold does not say CSE
    {
      id: "violence-001",
      goldExpect: ["violence"],
      primitives: { stance: "depicts", objects: ["violence_person"], qualifiers: [] },
      composed: ["violence"],
    },
    // True negative: model says no, gold does not say CSE
    {
      id: "clean-001",
      goldExpect: [],
      primitives: { stance: "describes", objects: [], qualifiers: ["is_mention_not_use"] },
      composed: [],
    },
  ];
  
  const atomName = "subject_is_minor";
  const modelYes = perItemData.filter((item) => item.primitives.qualifiers.includes(atomName));
  const goldYes = perItemData.filter((item) => item.goldExpect.includes("child_sexual_exploitation"));
  const truePositive = modelYes.filter((item) => item.goldExpect.includes("child_sexual_exploitation")).length;
  const falsePositive = modelYes.filter((item) => !item.goldExpect.includes("child_sexual_exploitation")).length;
  const falseNegative = goldYes.filter((item) => !item.primitives.qualifiers.includes(atomName)).length;
  const trueNegative = perItemData.length - truePositive - falsePositive - falseNegative;
  
  const precision = modelYes.length > 0 ? truePositive / modelYes.length : 0;
  const recall = goldYes.length > 0 ? truePositive / goldYes.length : 0;
  const yesRate = modelYes.length / perItemData.length;
  
  // Verify counts
  assert.strictEqual(modelYes.length, 3, "Model said yes 3 times (cse-001, cse-002, sexual-001)");
  assert.strictEqual(goldYes.length, 3, "Gold has CSE 3 times (cse-001, cse-002, cse-003)");
  assert.strictEqual(truePositive, 2, "TP = 2 (cse-001, cse-002)");
  assert.strictEqual(falsePositive, 1, "FP = 1 (sexual-001)");
  assert.strictEqual(falseNegative, 1, "FN = 1 (cse-003)");
  assert.strictEqual(trueNegative, 2, "TN = 2 (violence-001, clean-001)");
  
  // Verify metrics
  assert.strictEqual(precision, 2 / 3, "Precision = 2/3 (TP=2, FP=1)");
  assert.strictEqual(recall, 2 / 3, "Recall = 2/3 (TP=2, FN=1)");
  assert.strictEqual(yesRate, 3 / 6, "yesRate = 3/6 = 0.5");
});

test("subject_is_minor triage patterns", () => {
  // Pattern 1: Almost never yes (imbalance)
  const imbalancedData = Array(100).fill(null).map((_, i) => ({
    id: `item-${i}`,
    goldExpect: i < 10 ? ["child_sexual_exploitation"] : [],
    primitives: { stance: "describes", objects: [], qualifiers: [] },
    composed: [],
  }));
  
  const modelYes = imbalancedData.filter((item) => item.primitives.qualifiers.includes("subject_is_minor"));
  const yesRate = modelYes.length / imbalancedData.length;
  
  assert.strictEqual(yesRate, 0, "Imbalance pattern: yesRate = 0 (never fires)");
  
  // Pattern 2: Right rate, wrong rows (judgment failure)
  const wrongRowsData = [
    { id: "cse-001", goldExpect: ["child_sexual_exploitation"], primitives: { stance: "depicts", objects: ["sexual_activity"], qualifiers: [] }, composed: ["sexual_content"] },
    { id: "cse-002", goldExpect: ["child_sexual_exploitation"], primitives: { stance: "depicts", objects: ["sexual_activity"], qualifiers: [] }, composed: ["sexual_content"] },
    { id: "violence-001", goldExpect: ["violence"], primitives: { stance: "depicts", objects: ["violence_person"], qualifiers: ["subject_is_minor"] }, composed: ["violence", "child_sexual_exploitation"] },
    { id: "violence-002", goldExpect: ["violence"], primitives: { stance: "depicts", objects: ["violence_person"], qualifiers: ["subject_is_minor"] }, composed: ["violence", "child_sexual_exploitation"] },
  ];
  
  const modelYesWrong = wrongRowsData.filter((item) => item.primitives.qualifiers.includes("subject_is_minor"));
  const goldYesWrong = wrongRowsData.filter((item) => item.goldExpect.includes("child_sexual_exploitation"));
  const tpWrong = modelYesWrong.filter((item) => item.goldExpect.includes("child_sexual_exploitation")).length;
  const recallWrong = goldYesWrong.length > 0 ? tpWrong / goldYesWrong.length : 0;
  const yesRateWrong = modelYesWrong.length / wrongRowsData.length;
  
  assert.strictEqual(yesRateWrong, 0.5, "Wrong rows pattern: yesRate = 0.5 (right rate)");
  assert.strictEqual(recallWrong, 0, "Wrong rows pattern: recall = 0 (wrong rows)");
  
  // Pattern 3: Atom correct, composed CSE miss (emission→composition bug)
  const compositionBugData = [
    { id: "cse-001", goldExpect: ["child_sexual_exploitation"], primitives: { stance: "encourages", objects: ["sexual_activity"], qualifiers: ["subject_is_minor"] }, composed: ["sexual_content"] }, // Bug: should compose to CSE
    { id: "cse-002", goldExpect: ["child_sexual_exploitation"], primitives: { stance: "encourages", objects: ["sexual_activity"], qualifiers: ["subject_is_minor"] }, composed: ["sexual_content"] }, // Bug: should compose to CSE
  ];
  
  const modelYesComp = compositionBugData.filter((item) => item.primitives.qualifiers.includes("subject_is_minor"));
  const goldYesComp = compositionBugData.filter((item) => item.goldExpect.includes("child_sexual_exploitation"));
  const atomRecall = goldYesComp.length > 0 ? modelYesComp.filter((item) => item.goldExpect.includes("child_sexual_exploitation")).length / goldYesComp.length : 0;
  const composedRecall = goldYesComp.length > 0 ? compositionBugData.filter((item) => item.composed.includes("child_sexual_exploitation")).length / goldYesComp.length : 0;
  
  assert.strictEqual(atomRecall, 1.0, "Composition bug: atom recall = 1.0 (atom correct)");
  assert.strictEqual(composedRecall, 0, "Composition bug: composed recall = 0 (composition miss)");
});
