/**
 * Per-primitive prompting stub interfaces.
 * 
 * Paper: step 8. Provisional Section 3.3. The commons reference evaluation model is a trained artifact.
 * 
 * This interface defines the contract for per-primitive prompting, where each primitive
 * (stance, object, qualifier) gets its own dedicated pass through the model.
 * 
 * Current implementation: grouped compact 18-token decode (one pass, all primitives).
 * Future implementation: 18 separate passes, one per primitive.
 * 
 * Decision: Per-primitive first (18 passes) is preferred over grouped-first.
 * If 471×6 corpus evaluation proves too slow, subset corpus keys (CKs) rather than
 * reverting to grouped decode.
 */

export interface PerPrimitiveStub {
  /**
   * Build a prompt for a single stance classification.
   * @param content - The assistant response under evaluation
   * @param prompt - Optional user prompt that preceded the response
   * @returns Prompt text for stance classification
   * @throws Error with "not implemented" until per-primitive prompting is enabled
   */
  buildStancePrompt(content: string, prompt?: string): string;

  /**
   * Build a prompt for a single object classification.
   * @param content - The assistant response under evaluation
   * @param objectPrimitive - The object primitive to evaluate (e.g., "violence_person")
   * @param prompt - Optional user prompt that preceded the response
   * @returns Prompt text for object classification
   * @throws Error with "not implemented" until per-primitive prompting is enabled
   */
  buildObjectPrompt(content: string, objectPrimitive: string, prompt?: string): string;

  /**
   * Build a prompt for a single qualifier classification.
   * @param content - The assistant response under evaluation
   * @param qualifierPrimitive - The qualifier primitive to evaluate (e.g., "subject_is_minor")
   * @param prompt - Optional user prompt that preceded the response
   * @returns Prompt text for qualifier classification
   * @throws Error with "not implemented" until per-primitive prompting is enabled
   */
  buildQualifierPrompt(content: string, qualifierPrimitive: string, prompt?: string): string;

  /**
   * Serialize per-primitive verdict to canonical format.
   * @param verdicts - Map of primitive names to yes/no values
   * @returns Serialized verdict in per-primitive format
   * @throws Error with "not implemented" until per-primitive prompting is enabled
   */
  serializePerPrimitive(verdicts: Record<string, boolean>): string;
}

/**
 * Stub implementation that throws "not implemented" errors.
 * Replace this with a real implementation when enabling per-primitive prompting.
 */
export class PerPrimitiveStubImpl implements PerPrimitiveStub {
  buildStancePrompt(content: string, prompt?: string): string {
    throw new Error("Per-primitive prompting not implemented. Current implementation uses grouped compact 18-token decode.");
  }

  buildObjectPrompt(content: string, objectPrimitive: string, prompt?: string): string {
    throw new Error("Per-primitive prompting not implemented. Current implementation uses grouped compact 18-token decode.");
  }

  buildQualifierPrompt(content: string, qualifierPrimitive: string, prompt?: string): string {
    throw new Error("Per-primitive prompting not implemented. Current implementation uses grouped compact 18-token decode.");
  }

  serializePerPrimitive(verdicts: Record<string, boolean>): string {
    throw new Error("Per-primitive prompting not implemented. Current implementation uses grouped compact 18-token decode.");
  }
}
