#!/usr/bin/env python3
"""Test that analyze-f10.sh safety phase masks v2 E+M in public outputs.
Uses already-scored FRESH-09 s24 raw dirs (no GPU). Exit 0 iff mask holds."""
import json, os, re, subprocess, tempfile, shutil, sys
from pathlib import Path
SA = Path('/workspace/airp/decide/shared-adopt')
raw_avg = SA/'f09/pod/out/raw-avg/f09-s24/avg-f09-s24-ep2.0-2.5-3.0'
raw_ep = list((SA/'f09/pod/out/raw/f09-s24').glob('ckpt-epoch-2.0-*'))[0]
assert raw_avg.exists() and raw_ep.exists()
W = SA/'f10/test-mask-workdir'
if W.exists(): shutil.rmtree(W)
args = [str(SA/'f10/analyze-f10.sh'), 'safety', str(W),
        f'avg-f09-s24={raw_avg}', f'ind-f09-s24-ep2.0={raw_ep}']
proc = subprocess.run(args, capture_output=True, text=True)
print('STDOUT:\n', proc.stdout)
print('STDERR:\n', proc.stderr)
assert proc.returncode == 0, proc.returncode
# stdout must not contain unmasked "v2 N/M=K" pattern
assert 'v2 MASKED' in proc.stdout
assert re.search(r'v2\s+\d+/\d+=\d+', proc.stdout) is None, 'unmasked E+M leaked to stdout'
pub = json.load(open(W/'results-safety.json'))
for k,v in pub.items():
  assert v['v2E'] == 'MASKED' and v['v2M'] == 'MASKED' and v['v2EM'] == 'MASKED'
  assert isinstance(v['valF1'], float)
  assert 'safety_pass' in v
# internal may have numbers; public file must not stringify raw extras as ints in those keys
text = (W/'results-safety.json').read_text()
assert '"v2E": "MASKED"' in text and '"v2EM": "MASKED"' in text
# ensure full internal exists but is not what we print
assert (W/'results-full-internal.json').exists()
print('MASK_TEST_PASS')
