/**
 * Template v4 for primitives evaluator.
 *
 * Paper: step 8. Provisional Section 3.3. The commons reference evaluation model is a trained artifact.
 *
 * Template v4 changes from v3:
 * 1. Taxonomy catalogue OUT of the prompt — no flags.v0.json content
 * 2. Primitives catalogue only: stance, objects, qualifiers
 * 3. Keep the same decode shape (per-item structure) over primitive vocabulary
 * 4. Composition layer maps primitives → taxonomy flags at runtime (outside the prompt)
 *
 * Compact decode format (18 tokens):
 * - Token 1: stance (one of 5: describes, depicts, endorses, encourages, conveys_method)
 * - Tokens 2-8: yes/no for each of 7 objects (in catalogue order)
 * - Tokens 9-18: yes/no for each of 10 qualifiers (in catalogue order)
 */
import type { EvaluationRequest } from '@airp/core';
export declare const PROMPT_TEMPLATE_V4 = "primitives-v1";
/**
 * Primitives catalogue for template v4.
 * This replaces the full flags.v0.json taxonomy in the prompt.
 */
export interface PrimitivesCatalogue {
    vocabularyVersion: string;
    stance: ReadonlyArray<{
        readonly primitive: string;
        readonly definition: string;
        readonly ordinal: number;
    }>;
    objects: ReadonlyArray<{
        readonly primitive: string;
        readonly definition: string;
    }>;
    qualifiers: ReadonlyArray<{
        readonly primitive: string;
        readonly definition: string;
    }>;
}
/**
 * Primitives verdict structure.
 */
export interface PrimitivesVerdict {
    stance: string;
    objects: string[];
    qualifiers: string[];
}
/**
 * Parsed compact primitives verdict.
 */
export interface ParsedCompactPrimitives {
    stance: string;
    objects: string[];
    qualifiers: string[];
    unparseable: boolean;
}
/**
 * Primitives catalogue v1.
 * Derived from tools/evaluator-training/primitives/vocabulary.json.
 */
export declare const PRIMITIVES_CATALOGUE_V1: PrimitivesCatalogue;
/**
 * Build system prompt for template v4.
 * Primitives catalogue only — no taxonomy.
 */
export declare function buildV4System(catalogue?: PrimitivesCatalogue): string;
/**
 * Build user turn for template v4.
 */
export declare function buildV4User(req: EvaluationRequest): string;
/**
 * Build chat turns for template v4.
 */
export declare function buildV4ChatTurns(req: EvaluationRequest, catalogue?: PrimitivesCatalogue): {
    system: string;
    user: string;
};
/**
 * Concatenated prompt for hosts that do not speak chat turns.
 */
export declare function buildV4EvaluationPrompt(req: EvaluationRequest, catalogue?: PrimitivesCatalogue): string;
/**
 * Serialize primitives verdict to compact format.
 * Format: stance yes/no yes/no ... (18 tokens total)
 */
export declare function serializeCompactPrimitives(verdict: PrimitivesVerdict, catalogue?: PrimitivesCatalogue): string;
/**
 * Parse compact primitives verdict.
 */
export declare function parseCompactPrimitives(text: string, catalogue?: PrimitivesCatalogue): ParsedCompactPrimitives;
/**
 * GBNF grammar for compact primitives verdict.
 */
export declare function compactPrimitivesGbnf(catalogue?: PrimitivesCatalogue): string;
/**
 * SHA256 hex of exact buildV4System() bytes.
 * This pins the prompt template for training/gating reproducibility.
 */
export declare function promptSha256(catalogue?: PrimitivesCatalogue): string;
/**
 * Build system prompt for stance classification pass.
 */
export declare function buildStanceSystemPrompt(catalogue?: PrimitivesCatalogue): string;
/**
 * Build system prompt for object classification pass.
 */
export declare function buildObjectSystemPrompt(objectPrimitive: string, catalogue?: PrimitivesCatalogue): string;
/**
 * Build system prompt for qualifier classification pass.
 */
export declare function buildQualifierSystemPrompt(qualifierPrimitive: string, catalogue?: PrimitivesCatalogue): string;
/**
 * Build user prompt for per-primitive pass.
 */
export declare function buildPerPrimitiveUser(req: EvaluationRequest): string;
/**
 * Build all 18 per-primitive prompts in vocabulary order.
 * Returns array of {passType, primitive, systemPrompt}.
 */
export declare function buildAllPerPrimitivePrompts(catalogue?: PrimitivesCatalogue): Array<{
    passType: 'stance' | 'object' | 'qualifier';
    primitive: string;
    systemPrompt: string;
}>;
/**
 * Compute SHA256 of the per-primitive prompt bundle.
 * Concatenates all 18 system prompts in vocabulary order and hashes.
 * This is the family SHA for per-primitive-v1 decode shape.
 */
export declare function perPrimitivePromptBundleSha256(catalogue?: PrimitivesCatalogue): string;
//# sourceMappingURL=prompt-v4.d.ts.map