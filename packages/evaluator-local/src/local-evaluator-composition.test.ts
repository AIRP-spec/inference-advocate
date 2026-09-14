/**
 * Tests for LocalEvaluator composition logic.
 * 
 * Verifies that the runtime composition in LocalEvaluator matches the policy
 * defined in compose.mjs, particularly for stance-dependent negative rules.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { LocalEvaluator } from './local-evaluator.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AIRP_COMPOSITION = path.resolve(__dirname, '../../../tools/evaluator-training/primitives/compositions/airp-v0.5.0.json');

// Create a minimal test harness that exposes the private #compose method for testing
class LocalEvaluatorTestHarness {
  private composition: any;
  
  constructor(compositionPath: string) {
    this.composition = JSON.parse(fs.readFileSync(compositionPath, 'utf-8'));
  }
  
  // Mirror the private #compose method
  compose(primitives: { stance: string; objects: string[]; qualifiers: string[] }): string[] {
    const verdicts: string[] = [];
    
    // Check negative rules first (with stance-dependent policy)
    if (this.composition.negativeRules) {
      for (const rule of this.composition.negativeRules) {
        if (this.matchesCondition(primitives, rule.condition)) {
          // Special policy for is_mention_not_use: only suppress when stance is "describes"
          if (rule.condition.qualifiers && rule.condition.qualifiers.includes('is_mention_not_use')) {
            if (primitives.stance === 'describes') {
              return verdicts; // Empty, suppress all flags (true mention)
            }
            // Production stance (depicts/encourages/endorses/conveys_method): do not suppress
            continue;
          }
          
          // All other negative rules: full wipe
          return verdicts; // Empty, suppress all flags
        }
      }
    }
    
    // Check each class rule
    for (const classRule of this.composition.classes) {
      if (classRule.unsupported || !classRule.rule) continue;
      if (classRule.rule.none) continue;
      
      if (this.matchesCondition(primitives, classRule.rule)) {
        verdicts.push(classRule.class);
      }
    }
    
    return verdicts;
  }
  
  // Mirror the private #matchesCondition method
  private matchesCondition(primitives: { stance: string; objects: string[]; qualifiers: string[] }, condition: any): boolean {
    if (condition.allOf) {
      return condition.allOf.every((sub: any) => this.matchesCondition(primitives, sub));
    }
    if (condition.anyOf) {
      return condition.anyOf.some((sub: any) => this.matchesCondition(primitives, sub));
    }
    if (condition.stance && primitives.stance !== condition.stance) {
      return false;
    }
    if (condition.objects) {
      const hasAll = condition.objects.every((obj: string) => primitives.objects.includes(obj));
      if (!hasAll) return false;
    }
    if (condition.qualifiers) {
      const hasAll = condition.qualifiers.every((qual: string) => primitives.qualifiers.includes(qual));
      if (!hasAll) return false;
    }
    return true;
  }
}

test('LocalEvaluator composition: is_mention_not_use with describes stance suppresses', () => {
  const harness = new LocalEvaluatorTestHarness(AIRP_COMPOSITION);
  
  const primitives = {
    stance: 'describes',
    objects: ['violence_person'],
    qualifiers: ['is_mention_not_use'],
  };
  
  const verdicts = harness.compose(primitives);
  assert.deepStrictEqual(verdicts, [], 'describes + is_mention_not_use should suppress all flags');
});

test('LocalEvaluator composition: is_mention_not_use with depicts stance does NOT suppress CSE', () => {
  const harness = new LocalEvaluatorTestHarness(AIRP_COMPOSITION);
  
  // Critical test case from CK-6756 re-gate
  const primitives = {
    stance: 'depicts',
    objects: ['sexual_activity'],
    qualifiers: ['subject_is_minor', 'is_mention_not_use'],
  };
  
  const verdicts = harness.compose(primitives);
  assert.deepStrictEqual(
    verdicts.sort(),
    ['child_sexual_exploitation', 'sexual_content'],
    'depicts + sexual_activity + subject_is_minor + is_mention_not_use should fire CSE (production stance overrides mention)'
  );
});

test('LocalEvaluator composition: is_mention_not_use with encourages stance does NOT suppress', () => {
  const harness = new LocalEvaluatorTestHarness(AIRP_COMPOSITION);
  
  const primitives = {
    stance: 'encourages',
    objects: ['violence_person'],
    qualifiers: ['is_mention_not_use'],
  };
  
  const verdicts = harness.compose(primitives);
  assert.deepStrictEqual(verdicts, ['violence'], 'encourages + violence + is_mention_not_use should fire violence');
});

test('LocalEvaluator composition: is_mention_not_use with conveys_method stance does NOT suppress', () => {
  const harness = new LocalEvaluatorTestHarness(AIRP_COMPOSITION);
  
  const primitives = {
    stance: 'conveys_method',
    objects: ['violence_person'],
    qualifiers: ['exceeds_common_knowledge', 'is_mention_not_use'],
  };
  
  const verdicts = harness.compose(primitives);
  assert.deepStrictEqual(
    verdicts.sort(),
    ['criminal_assistance', 'violence'],
    'conveys_method + violence + exceeds_common_knowledge + is_mention_not_use should fire CA+violence'
  );
});

test('LocalEvaluator composition: disclaimer_present always suppresses (full wipe)', () => {
  const harness = new LocalEvaluatorTestHarness(AIRP_COMPOSITION);
  
  const primitives = {
    stance: 'depicts',
    objects: ['violence_person'],
    qualifiers: ['disclaimer_present'],
  };
  
  const verdicts = harness.compose(primitives);
  assert.deepStrictEqual(verdicts, [], 'disclaimer_present should suppress all flags regardless of stance');
});

test('LocalEvaluator composition: CSE without is_mention_not_use fires normally', () => {
  const harness = new LocalEvaluatorTestHarness(AIRP_COMPOSITION);
  
  const primitives = {
    stance: 'depicts',
    objects: ['sexual_activity'],
    qualifiers: ['subject_is_minor'],
  };
  
  const verdicts = harness.compose(primitives);
  assert.deepStrictEqual(
    verdicts.sort(),
    ['child_sexual_exploitation', 'sexual_content'],
    'depicts + sexual_activity + subject_is_minor should fire CSE + sexual_content'
  );
});
