# Building the reference evaluator: lessons from the process

Notes kept during the fine-tune of the AIRP reference evaluation model, August 2026. First time training a language model of any kind; prior model-training experience was computer vision (cube-checker classifiers), which transferred less than expected in some places and more in others. Written for posterity and for explaining the process to others.

## The headline: a small model zero-shot is not a judge, and proving it took three tries

The plan started with a pinned small instruct model (Qwen3-0.6B) run zero-shot against the flag taxonomy, on the theory that semantic evaluation is a light classification task. It is a light task. The model still could not do it, in any of three decode configurations:

- Multi-label in one call: the model collapsed everything into two attractor labels and under-fired.
- Per-class binary with JSON output: better, but over-fired, and best case was 14 of 22 golden fixtures.
- Per-class binary with a bare yes/no grammar: collapsed onto "yes" entirely. A plain greeting fired ten of eleven classes.

The finding underneath all three: the verdicts flipped with the output format while the judgment content was held constant. A judge whose answer depends on how it is allowed to spell the answer has no authority to lose. That killed the zero-shot approach and moved the fine-tune from "eventual destination" to "the actual next step." The paper had always specified a trained artifact; we just paid in three failed runs for the evidence that confirmed it.

Lesson: "the task is easy" and "a small model can do it zero-shot" are different claims. The first was true and the second was false, and only fixture data separated them.

## Latency and accuracy were the same problem wearing two hats

The per-class approach cost 40-plus seconds per response on the reference droplet. The instinct was to blame the decode configuration (thinking mode, sloppy generation). Partly right, but the deeper cause was that the model fired almost every class on almost every input, and each fire bought an evidence-extraction call. Over-firing was both the accuracy failure and the latency failure. A greeting that fires ten classes is both wrong and slow, for the same reason.

Lesson: when a system is both slow and inaccurate, check whether one fault is producing both before optimizing them separately.

## The gate has to exist before the thing it certifies

The strongest process decision was building the held-out certification suite (187 items, handwritten from the published definitions) and freezing it before any training data existed. It caught real problems twice: it rejected the zero-shot pins on merit, and later it exposed that the first training corpus was labeled in a way that contradicted the gate itself.

The rule that made it work: the suite is never trained against, its digest is pinned, and any change to it is a reviewed amendment. When a test failed because an amendment changed a fact the test had pinned, the test refused to certify silently. That is the property you want everywhere.

Lesson: certification data built after the model, or by the same process that built the model, certifies nothing. Build the gate first and keep it sacred.

## The corpus and the gate can silently disagree, and only review finds it

The first training corpus labeled violence how-to ("apply pressure to the carotid," "cut tendons to disable movement") as violence-only. But attack how-to also meets the criminal-assistance definition, and the held-out gate expected both labels on that content. Training on that corpus would have taught the model to fail its own certification. Nothing automated caught this; a human reading a stratified sample caught it, because the labels were internally consistent and only wrong against the taxonomy's actual boundaries.

Lesson: two adjacent harm categories with overlapping definitions will drift between your training labels and your evaluation labels unless you handle the overlap explicitly, everywhere content is labeled. Sampling and reading is not optional QA; it is the only thing that finds this class of error.

## Generation runs into the size of the space, not just the quality of the prompt

Two hard stops came from the same cause: the writer model could not produce enough unique items to fill a requested count. "The capital of France is Paris" is the single most probable fact sentence a model can emit, so it collided with the held-out suite immediately. And 200 unique fixture-register greetings simply do not exist; the writer exhausted the space around 150 and then every new attempt duplicated an earlier one. Better variety instructions helped a little. They could not manufacture headroom the space did not contain.

The fix was to request counts each family can actually fill and move the remainder into families with unbounded variety (helpful responses), rather than loosening the duplicate check, which would have inflated one narrow region of the distribution with near-copies.

Lesson: some categories are naturally low-variety. Ask them for a fillable number. Do not fight arithmetic with prompt engineering, and do not weaken your dedup to hide the problem.

## Refusal contamination is a quiet poison

When you ask a writer model to generate positive examples of a harmful class, it sometimes refuses ("I will not write that"), and that refusal, if not screened, gets stored with the positive label. The model then learns that refusals are hate, or violence, or sexual content, which is exactly the false-positive family the fine-tune exists to eliminate. The screen has to be family-scoped, because refusal language is correct content for the refusal and denial categories.

Lesson: never let the generator's judgment become a label. Labels come from the slot specification; the generator writes text, and text that does not conform to the slot gets rejected and counted, not stored.

## The writer's refusal boundary does not track human severity intuition

This one was genuinely surprising. Asked to produce positive examples across the harm classes, the writer model (Qwen2.5-32B-Instruct) wrote violence method instruction ("cut the throat to sever the arteries") and self-harm instruction without complaint, then refused, eight retries straight, to write an expletive for a profanity positive, and refused slurs for hate positives hardest of all. The slot that finally exhausted the run was not one of the grave harm classes. It was profanity.

The reason appears to be that profanity and slur filtering is a surface-feature task that gets hammered in alignment training and is easy to enforce, while "is this sentence describing violence" is subtler and less tightly guarded. So the model's refusal behavior is tuned to surface tokens more than to described harm, and the severity ordering it enforces is close to inverted from the ordering a human would assign.

The consequence for the pipeline: which classes can be writer-generated versus which must be composed locally is an empirical property of the specific writer model, not something you can reason out in advance from how "bad" each class is. Profanity and hate had to move to local composition, the same mechanism already used for child sexual exploitation, though for a different reason: CSE must never be generated, while profanity and hate simply cannot be generated by this writer because it refuses and there is no softer valid output for a binary conformance check to accept.

Lesson: discover your writer's actual refusal boundary by running it, not by predicting it. Build visibility (a compose-versus-generate split report) so the boundary is stated up front rather than found by a slot exhausting mid-run. And keep local composition as a general tool, usable both for content that must never be generated and for content the writer will not reliably generate.

## Composition solves refusal but introduces a scaffolding trap

Moving profanity and hate to local composition fixed the writer-refusal wall. It also created a new failure that no automated check could see. The first scaffolds wrote *about* the class instead of *in* it: "This fixture uses wetback as a slur," "Calling you a dickhead is the fixture." Those sentences describe profanity and hate rather than exhibiting them, which is the exact mention-versus-use boundary the whole corpus exists to teach. Training on them would teach the model to fire on sentences that merely discuss a category, and to fire on the word "fixture."

The conformance screen could not catch it, because a sentence describing a slur still contains the slur, so it passed the only automated gate. A human reading the composed slice caught it in one pass.

Lesson: composition trades the writer's refusal problem for a scaffold-quality problem, and the trade is not free. A carelessly written scaffold reintroduces the precise error you built the corpus to eliminate, and it does so invisibly to every check that passed the writer-generated data. For any composed class, the human read of the composed slice is not one check among many; it is the only gate. Weight it accordingly. And the scaffold rule is simple: the content is the utterance, never a description of the utterance.

## Some content should never be generated at all

For the child-exploitation class, the decision was that the writer model is never prompted to produce exhibiting text, at any volume, for any classifier-training purpose. Those positives are composed locally from a small non-explicit scaffold in the style of the held-out items, and the invariant is enforced in code (the slot builder throws if that class ever enters the writer path). Everything else about that class, refusals and protective discussion, is safe writer output and stays.

Lesson: "it is for training a safety classifier" does not change what the output is. Draw the line at generation, enforce it in code, not in a comment.

## Resuming a generation run is a trap; make the expensive phase resumable instead

When a run halts partway, the instinct is to resume from where it stopped. For this corpus generation it is the wrong instinct. The duplicate-detection set is rebuilt empty each run, so appending to an existing file would let cross-run duplicates through. Worse, a halt usually leads to a recipe change, and appending new-plan output to old-plan output produces a corpus that matches no single recipe, defeating the reproducible-from-recipe discipline. The corpus must correspond to one recipe, one seed, one run.

This is tolerable only because generation is the cheap phase (minutes, on an already-warm pod). The expensive phase is training, and that is the one worth checkpointing. If generation ever did need resumption, the correct design is deterministic per-slot output keyed on (seed, slot id) plus reading the existing file into the dedup set at startup, so a rerun reproduces byte-identical results and completed slots are skipped safely. Append-and-hope is not that.

Lesson: match effort to cost. Full re-runs for cheap deterministic phases; real checkpoint discipline for the expensive one. And never resume by appending unless the resume is byte-reproducible.

## A falling loss curve can hide a capacity ceiling; sweep the whole curve to tell them apart

This was the most expensive lesson of the project, six training runs to learn it. The reference evaluator kept failing the gate. The training loss looked healthy every time: it fell smoothly toward zero. That healthy-looking curve sent the diagnosis in circles.

Run one failed because assistant masking was broken (loss computed over the fixed prompt, not the verdict), so the model learned "clean fires nothing" and little else. Fixing the mask helped a lot. Then more epochs made it worse (overfitting), fewer epochs made it worse in the other direction (underfitting, collapsed recall). At that point the evidence looked like a capacity ceiling, then looked like overfitting when the loss curves showed near-zero final loss, then looked like a ceiling again when undertraining failed too. The diagnosis swung back and forth because each run was a single point, and you cannot fit a curve through one point.

The mistake in the reasoning: a monotonically decreasing loss does not tell you whether the model is generalizing. A small model can drive training loss to 0.0003 by memorizing the training set, while its held-out behavior stays bad. Low loss and good generalization are different things, and the loss curve alone cannot distinguish them. Reading "loss is still falling" as "keep training" or "loss is near zero" as "it learned the task" are both traps.

What actually settled it: one training run that saved a checkpoint every half epoch and gated each checkpoint against the held-out suite. That sweeps the entire loss curve in a single run and shows the held-out score at every point along it. The result was a clean seesaw. Early checkpoints (underfit) had good precision but catastrophic recall, because a model that rarely fires cannot false-fire. Late checkpoints (overfit) recovered recall but climbed in false fires. The middle, the region never sampled by the endpoint runs, turned out to be the worst part of the curve, not a hidden sweet spot. No checkpoint passed a single per-class gate. That is what a real capacity ceiling looks like: not one bad number, but a whole curve with no good point on it.

Lesson: when a model fails a held-out gate and you are unsure whether the cause is underfitting, overfitting, or capacity, do not infer it from one or two training runs at chosen stopping points. The endpoints lie. Sweep checkpoints across the full training curve and gate each one. If a good stopping point exists it shows as a dip; if every checkpoint fails, the ceiling is measured, not guessed. This converts an argument into a fact, and it costs one training run instead of many. It is also the difference between "I think we need a bigger model" and "the entire curve is sampled and bad, so we need a bigger model." Only the second earns the model-size jump.

Corollary: build the checkpoint sweep as a reusable tool, not a one-off. The same sweep points at the next model to find its best checkpoint directly, instead of guessing hyperparameters again.

## What transferred from computer vision, and what did not

Transferred: the discipline of a held-out set you never train against, and the habit of reading your own data rather than trusting aggregate metrics. A cube-checker that scores well on paper and fails on the bench taught that lesson already.

Did not transfer: the failure modes are stranger. A vision model that misclassifies does so quietly and locally. A language judge fails by collapsing onto one answer, by changing its mind based on output format, by refusing the task and having the refusal labeled as the thing it refused, by refusing a mild class while complying with a grave one. The errors have intent-shaped and alignment-shaped structure that pixel classifiers do not.

## The meta-lesson

Almost every real problem in this process was found by a human reading a sample, and almost every problem was invisible to the automated checks that passed right alongside it. The format-identity tests passed while the labels contradicted the gate. The verdict-consistency check passed while the greeting fired ten classes. The pipeline was green at every step where the corpus was wrong. Read it.
