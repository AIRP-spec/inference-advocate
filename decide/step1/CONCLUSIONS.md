## Do the earlier conclusions survive?

**"stance:describes precision 0.23": does NOT survive. It was a proxy artifact, not a model result.**
- The old proxy marked describes gold-no on every item outside persona_claims / simulation_obscured / sycophancy. That includes the 212 empty-label items, the mention-versus-use negatives, and the hate, profanity and CSE-only items. The class labels do not fix the stance of any of those; most are describes by construction.
- On v2, Qwen CK-8560 describes had 223 "FP" under the old proxy. Under the settled mapping those items are *unknown*.
- On the items whose stance the composition forces (68 describes, 31 conveys_method, 23 encourages), describes P/R is:
  - Qwen: 1.00 / 0.99–1.00 on every CK and readout
  - Laya original: 1.00 / 0.99–1.00
  - Laya retrain: 0.99 / 0.97–0.99 (converged checkpoints)
- The same artifact produced the old endorses 0.18–0.26 and the old encourages/conveys_method recall of about 0.4–0.5. Endorses and depicts cannot be scored from class labels at all, so the old endorses number measured nothing.

**"Laya's weak spots are data problems": does NOT survive as stated.** Task 1 named three weak spots. Under the settled proxies two of them disappear and the third is shared and unmeasurable per-primitive.
1. *violence_person recall 0.53: proxy artifact.* The old proxy counted the 21 CA-only items as gold-yes. Under the composition those items are certain to **lack** violence_person. Settled recall is 1.00 for Qwen on every CK and 0.96–1.00 for every converged Laya checkpoint, with precision 0.92–1.00 for both. This is neither a Laya weakness nor a data problem.
2. *Weak stance: proxy artifact* (see above). On the determined subset, both models are near ceiling. Laya retrain is slightly behind:
   - encourages 0.81–0.85 / 0.96 vs Qwen 0.88–0.96 / 1.00
   - stance admissibility 198–200/207 vs Qwen 202–204/207
   - Laya original matches Qwen (encourages 0.88–0.92 / 1.00, admissibility 201–203/207)

   This says nothing about depicts or endorses, which held-out class labels cannot test.
3. *intrusion / weapons never fire:* still true for **both** models, so it is not Laya-specific.
   - 0 fires on v2 for every Qwen output and for every Laya output at default thresholds.
   - The exceptions are threshold artefacts. The original run's archived "fitted" set has threshold 0.0 for both, so they fire on every item (already disclosed in Task 1). One non-converged retrain 2b set fires on at most 1.5% of items.
   - Their per-primitive P/R is now excluded: class labels cannot say which CA object an item carries.
   - The "data problem" part (zero training-label positives) is a training-label fact that this re-score neither shows nor refutes. That is Step 2.
   - The supplementary composite any(financial_crime, intrusion, weapons) on CA-without-violence items has recall 1.00 for every Qwen output and for every converged Laya checkpoint at default thresholds. So both models route every non-violent CA item through financial_crime.

**Where Laya does trail Qwen under the settled proxies** (converged checkpoints, default thresholds; the differences are not explained by the proxy change):
- *exceeds_common_knowledge precision.* Laya converged 0.61–0.76 vs Qwen 0.86–0.89. Laya has higher recall: 0.94–0.97 vs Qwen 0.81.
  - Precision is a lower bound because of the self-harm caveat, but the gap holds after removing self-harm FPs:
    - Laya 10160: 30/39 = 0.77 (6 clean + 3 violence-only FPs)
    - Qwen CK-8560 greedy: 25/26 = 0.96
- *addresses_own_nature precision* on the retrain: 0.61–0.71 vs Qwen 0.73–0.82. At retrain 9610, all 11 FPs are clean items.
- *composite CA-object precision:* Laya 0.75–0.84 vs Qwen 0.88–0.91.

These are model precision/recall trade-offs, not label gaps. They are consistent with the composed-class result (more extras for Laya).

**Composed class results are unchanged.** Gate numbers come from composed classes, not proxies. Every v2 / v1-207 extras / misses / clean-fires and CSE number in the Task 1 and Task 2 reports stands.
