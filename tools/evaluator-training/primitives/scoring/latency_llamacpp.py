#!/usr/bin/env python3
"""Task 2 latency cross-check with llama-cpp-python on the same Q8_0 GGUF and the exact token ids
dumped by score-per-primitive.mjs dump-tokens. Measures per item (17 passes):
  greedy        : grammar-constrained greedy, gate caps (stance 16, yes/no 2), automatic prefix reuse
  scoredNoReuse : probability readout from the raw logits array, KV cleared before every pass
  scoredReuse   : probability readout keeping the KV prefix shared with the previous pass
Also returns the scored top answers so they can be compared with the node-llama-cpp readout."""
import json, sys, time, math, argparse
import numpy as np
from llama_cpp import Llama, LlamaGrammar

ap = argparse.ArgumentParser()
ap.add_argument('--gguf'); ap.add_argument('--tokens'); ap.add_argument('--out')
ap.add_argument('--gpu', action='store_true'); ap.add_argument('--threads', type=int, default=None)
a = ap.parse_args()
dump = json.load(open(a.tokens))
llm = Llama(model_path=a.gguf, n_ctx=4096, n_gpu_layers=-1 if a.gpu else 0, logits_all=False, verbose=False, seed=1, n_threads=a.threads, n_batch=512)
ans_tok = {k: v for k, v in dump['answerTokens'].items()}
g_stance = LlamaGrammar.from_string('root ::= ' + ' | '.join('"%s"' % s for s in ['describes', 'depicts', 'endorses', 'encourages', 'conveys_method']), verbose=False)
g_yn = LlamaGrammar.from_string('root ::= "yes" | "no"', verbose=False)

def kv_rm(start):
    ctx = llm._ctx
    for name in ('kv_cache_seq_rm', 'memory_seq_rm'):
        f = getattr(ctx, name, None)
        if f:
            f(-1, start, -1); break
    else:
        raise RuntimeError('no kv seq_rm on this llama-cpp-python')
    llm.n_tokens = start

def set_state(tokens, reuse):
    k = 0
    if reuse:
        cur = llm.input_ids[:llm.n_tokens]
        m = min(len(cur), len(tokens))
        while k < m and cur[k] == tokens[k]: k += 1
    kv_rm(k)
    if len(tokens) > k: llm.eval(tokens[k:])

def logsoftmax_at(idx_tokens):
    row = llm.scores[llm.n_tokens - 1]
    mx = row.max(); lse = mx + math.log(np.exp(row - mx).sum())
    return {t: float(row[t] - lse) for t in idx_tokens}

def score_pass(P, answers, reuse):
    set_state(P, reuse)  # logits of last prompt token available
    first = logsoftmax_at({ans_tok[x][0] for x in answers})
    lp = {}
    for x in answers:
        toks = ans_tok[x]; s = first[toks[0]]
        if len(toks) > 1:
            kv_rm(len(P))
            for j in range(len(toks) - 1):
                llm.eval([toks[j]])
                s += logsoftmax_at([toks[j + 1]])[toks[j + 1]]
        lp[x] = s
    if llm.n_tokens > len(P): kv_rm(len(P))
    m = max(lp.values()); z = sum(math.exp(v - m) for v in lp.values())
    probs = {x: math.exp(v - m) / z for x, v in lp.items()}
    return max(answers, key=lambda x: (probs[x], -answers.index(x))), probs

def greedy_pass(P, stance):
    out = llm.create_completion(prompt=P, max_tokens=16 if stance else 2, temperature=0.0, top_k=1, grammar=g_stance if stance else g_yn)
    return out['choices'][0]['text']

res = {'gguf': a.gguf, 'gpu': a.gpu, 'n': len(dump['items']), 'modes': {}, 'tops': {}, 'greedy': {}, 'llamaCppPythonVersion': __import__('llama_cpp').__version__}
# warm
w = dump['items'][0]
for p in w['passes']:
    score_pass(p['tokens'], p['answers'], False); greedy_pass(p['tokens'], p['passType'] == 'stance')
for mode in ('greedy', 'scoredNoReuse', 'scoredReuse'):
    kv_rm(0)
    ms = []
    for it in dump['items']:
        t0 = time.perf_counter()
        tops = {}
        for p in it['passes']:
            if mode == 'greedy':
                tops[p['primitive']] = greedy_pass(p['tokens'], p['passType'] == 'stance').strip()
            else:
                tops[p['primitive']] = score_pass(p['tokens'], p['answers'], mode == 'scoredReuse')[0]
        ms.append((time.perf_counter() - t0) * 1000)
        if mode == 'scoredReuse': res['tops'][it['id']] = tops
        if mode == 'greedy': res['greedy'][it['id']] = tops
    res['modes'][mode] = ms
def q(v, p):
    s = sorted(v); return s[min(len(s) - 1, math.ceil(p * len(s)) - 1)]
res['summary'] = {k: {'n': len(v), 'medianMs': q(v, .5), 'p95Ms': q(v, .95), 'meanMs': sum(v) / len(v)} for k, v in res['modes'].items()}
json.dump(res, open(a.out, 'w'))
print(json.dumps(res['summary'], indent=1))
