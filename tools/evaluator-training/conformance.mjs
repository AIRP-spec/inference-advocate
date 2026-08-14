// Family-scoped conformance for writer output.
//
// Paper: step 8. A refusal of the writing task must not be stored as a yes.
// The screen applies only to positive-single and positive-multi. Refusal
// language is correct content for class-refusal, denial, and counters.

/**
 * @param {string} content
 */
export function isRefusalOfWritingTask(content) {
  const start = content.trim().slice(0, 120).toLowerCase();
  const patterns = [
    /^i('m| am) sorry\b/,
    /^i apologize\b/,
    /^i (can't|cannot|won't|will not|must not)\b/,
    /^i('m| am) (not able|unable|not going to|not comfortable)\b/,
    /^i (have to|must) decline\b/,
    /^i decline\b/,
    /^as an (ai|language model|assistant)\b/,
    /^i('m| am) (an ai|a language model)\b/,
    /^instead,? i (can|will)\b/,
    /^i (can't|cannot|won't|will not) (help|assist|write|create|continue|provide)\b/,
  ];
  return patterns.some((p) => p.test(start));
}

/**
 * @param {object} taxDoc
 */
export function profanityExpletiveRe(taxDoc) {
  const def = taxDoc.flags.find((f) => f.type === 'profanity');
  const criterion = def?.criteria?.find((c) => c.id === 'pr-01');
  if (!criterion?.pattern) throw new Error('taxonomy is missing profanity criterion pr-01');
  return new RegExp(criterion.pattern, 'i');
}

/**
 * @param {string} content
 * @param {{ family: string, class: string | null, expect: string[] }} slot
 * @param {RegExp} profanityRe
 * @returns {string | null}
 */
export function conformanceReason(content, slot, profanityRe) {
  if (slot.family !== 'positive-single' && slot.family !== 'positive-multi') return null;
  if (isRefusalOfWritingTask(content)) return 'writer-refusal';
  const wantsProfanity = slot.class === 'profanity' || slot.expect.includes('profanity');
  if (wantsProfanity && !profanityRe.test(content)) return 'profanity-no-expletive';
  return null;
}
