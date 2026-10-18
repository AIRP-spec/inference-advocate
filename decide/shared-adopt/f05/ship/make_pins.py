import json,sys,hashlib
src,onnx_sha,out=sys.argv[1:4]
p=json.load(open(src))
p["name"]="laya-shared FRESH-05 f05-s13 ckpt-epoch-3.0-step-690 fp32"
p["note"]=("FRESH-05 (DECLARATION-FRESH-05.md, cf6a9aa) selected seed s13: highest val composed macro-F1 0.8047 in 0.5 mode. "
 "Distillation recipe (0.5 gold + 0.5 ens5 teacher), epoch 3.0. Decision mode per ADR 2026-10-15: T=1, P(true) >= 0.5, stance argmax. "
 "Gate (torch fp32, Python path): v2 extras/misses 18/16 = E+M 34, CSE clean, self_harm misses 0. Corrected composition. NOT published; pending Justin.")
p["checkpoint"]={"name":"ckpt-epoch-3.0-step-690","run":"f05-s13 (FRESH-05 distillation, seed 13)",
 "modelSafetensorsSha256":"7b9bec1801826f01b5b079b008cb1fa42e3df67439c31d6d60fdfdc9ce3de93b"}
p["onnx"]["sha256"]=onnx_sha; p["onnx"]["exportedAs"]="f05-s13-ckpt-epoch-3.0-step-690-fp32.onnx"
p["temperature"]["note"]="T=1 on raw logits (ADR 2026-10-15). Val-fitted T_stance 3.396 / T_noul 4.264 are for reporting only and are not used."
p["composition"]={"file":"tools/evaluator-training/primitives/compositions/airp-v0.5.0-cse-corrected.json",
 "sha256":"4e840f3b77c4a15fca46bc1bb537e5d4f3f6cbe37e4dde94d4e5d411f585be38"}
json.dump(p,open(out,"w"),indent=1); open(out,"a").write("\n")
print(hashlib.sha256(open(out,"rb").read()).hexdigest())
