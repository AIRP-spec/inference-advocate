"""R-16 item 3 dry run ON THE BOX, no pod: 2-minute cap. A fake pod stays 'alive' until the guard's terminate_fn is called. The main thread does exactly
what hx-t16's did: sits in the pull path (vps_pipe on a hung 'VPS', here `sleep 3600`) and in an unbounded time.sleep in a second thread.
PASS = (1) the guard calls terminate at the deadline +-5 s although both are blocked, (2) vps_pipe raises CapExceeded at deadline - margin,
(3) pod_gone_at is recorded. Run: python3 tests/dryrun_guard.py [seconds]   (default 120)"""
import json, sys, threading, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pod_guard as PG
import headext_pod_train as D

CAP = float(sys.argv[1]) if len(sys.argv) > 1 else 120.0
t0 = time.time(); alive = [True]; ev = {}
def term(pid): ev["terminate_called"] = time.time() - t0; alive[0] = False
def pods(): return [{"id": "FAKEPOD"}] if alive[0] else []
def log(*a): print(f"[{time.time() - t0:7.1f}s]", *a, flush=True)
g = PG.PodGuard("FAKEPOD", t0 + CAP, term, pods, log=log, poll_s=5).start(); D.GUARD[0] = g; D.PULL_MARGIN_S = 10; D.log = log
threading.Thread(target=lambda: time.sleep(3600), daemon=True).start()          # a second thread blocked with no timeout
try:
    D.vps_pipe("sleep 3600")                                                      # the hx-t16 main-thread situation
    ev["main"] = "NOT BOUNDED"
except PG.CapExceeded as e:
    ev["main_raised_cap_at"] = time.time() - t0; ev["main"] = "CapExceeded"; log("main thread:", e)
time.sleep(max(0, CAP + 8 - (time.time() - t0)))
ev["pod_gone_at_s"] = (g.gone_at - t0) if g.gone_at else None
ok = (ev.get("main") == "CapExceeded" and abs(ev["main_raised_cap_at"] - (CAP - D.PULL_MARGIN_S)) < 6
      and ev.get("terminate_called") is not None and abs(ev["terminate_called"] - CAP) < 6 and ev["pod_gone_at_s"] is not None)
ev["cap_s"] = CAP; ev["PASS"] = ok; print(json.dumps(ev, indent=1)); sys.exit(0 if ok else 1)
