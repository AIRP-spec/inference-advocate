# Proposed shared-model bundle layout (not published)

```
laya-shared-a570/
  model.onnx                  # fp32, one encoder + 17 heads (sha pinned)
  tokenizer/                  # from base snapshot rev 55cf4c4e
  pins.json                   # thresholds 0.5/argmax, T=1, question SHAs, max_len 1024, modelSha256
  composition/airp-v0.5.0.json
  MODEL-CARD.md
  MANIFEST.sha256
```

Deterministic tarball (sorted, mtime 0) like the 5766 bundle. CI patch pins the archive SHA-256 and URL after Justin publishes.
