"""R-16 item 3: driver-side hard cap for a training pod (fix for the hx-t16 time-cap overrun).

hx-t16 (t228u driver, 2026-11-21/22): the in-pod watchdog and the box watchdog.py both worked (the pod was gone at ~23:18Z, about 105 min,
balance 33.315 -> 31.718 = $1.60), but the DRIVER's main thread sat inside pull(hx-s103) -> vps_pipe -> A.sh / A.vps for ~3 h: those calls had no
timeout, nested retries (A.sh 6x on rc 255, vps_pipe 5x with 30..240 s sleeps) and no deadline check, so the monitor loop's
`time.time() > deadline - CLOSE_S` test was not reached until 01:44Z. The driver then wrote cost = rate x its own wall minutes ($3.752) into the
ledger, although the pod had been gone for 2.5 h.

PodGuard: a daemon thread, independent of the main thread, that (1) calls terminate at the hard deadline (retrying until GraphQL no longer lists
the pod) and (2) records the moment the pod is seen gone (`gone_at`) so the driver stops waiting on it and costs the pod to that moment.
run_capped(): a subprocess runner whose total time, including retries and sleeps, is bounded by a deadline (raises CapExceeded).
No network, no RunPod calls in this module; callers inject terminate_fn / pods_fn / clock, so it is testable on the box with no pod."""
import subprocess, threading, time


class CapExceeded(RuntimeError):
    pass


class PodGuard:
    def __init__(self, pid, deadline, terminate_fn, pods_fn, now=time.time, sleep=time.sleep, log=print, poll_s=15.0, retry_s=10.0, give_up_s=600.0):
        self.pid, self.deadline = pid, deadline
        self.terminate_fn, self.pods_fn, self.now, self.sleep, self.log = terminate_fn, pods_fn, now, sleep, log
        self.poll_s, self.retry_s, self.give_up_s = poll_s, retry_s, give_up_s
        self.gone_at = None          # clock time the pod was first seen absent from the pod list
        self.fired_at = None         # clock time the guard issued a terminate at the hard deadline
        self.stop = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True, name="pod-guard")

    def start(self):
        self.thread.start(); return self

    def seen_gone(self):
        try:
            return self.pid not in {p["id"] for p in self.pods_fn()}
        except Exception as e:                   # a failed poll is not "gone" (box watchdog.py treats it the same way)
            self.log(f"guard poll error {repr(e)[:120]}"); return False

    def _run(self):
        while not self.stop.is_set():
            if self.seen_gone():
                self.gone_at = self.now(); self.log(f"GUARD: pod {self.pid} gone at {time.strftime('%H:%M:%S', time.localtime(self.gone_at))}"); return
            if self.now() >= self.deadline:
                break
            self.sleep(min(self.poll_s, max(0.05, self.deadline - self.now())))
        if self.stop.is_set(): return
        self.fired_at = self.now(); self.log(f"GUARD: hard deadline reached, terminating {self.pid}")
        t_give = self.now() + self.give_up_s
        while not self.stop.is_set() and self.now() < t_give:
            try: self.terminate_fn(self.pid)
            except Exception as e:
                if "POD_NOT_FOUND" in repr(e): self.gone_at = self.gone_at or self.now(); return
                self.log(f"GUARD: terminate retry {repr(e)[:120]}")
            if self.seen_gone():
                self.gone_at = self.now(); self.log(f"GUARD: pod {self.pid} confirmed gone"); return
            self.sleep(self.retry_s)
        self.log(f"GUARD: gave up after {self.give_up_s:.0f} s; pod {self.pid} may still exist")

    def remaining(self, margin=0.0):
        return self.deadline - margin - self.now()


def run_capped(cmd, limit, per_call=600.0, retries=3, now=time.time, sleep=time.sleep, retry_rc=(255,), check=True, **kw):
    """subprocess.run with a TOTAL budget: `limit` is an absolute clock time (None = no deadline, per_call only). Each attempt is cut at
    min(per_call, time left); a retry (rc in retry_rc, e.g. ssh 255) sleeps min(10 s, time left). Never blocks past `limit`.
    Raises CapExceeded when the budget is spent, RuntimeError when check and the last rc != 0."""
    r = None
    for i in range(retries):
        left = (limit - now()) if limit is not None else per_call
        if left <= 0: raise CapExceeded(f"cap reached before {str(cmd)[:80]}")
        try:
            r = subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True, timeout=min(per_call, left), **kw)
        except subprocess.TimeoutExpired:
            if limit is not None and limit - now() <= 0: raise CapExceeded(f"cap reached during {str(cmd)[:80]}")
            r = None; continue
        if r.returncode not in retry_rc: break
        left = (limit - now()) if limit is not None else 10
        if left <= 0: raise CapExceeded(f"cap reached while retrying {str(cmd)[:80]}")
        sleep(min(10, left))
    if r is None: raise RuntimeError(f"timed out {retries}x: {str(cmd)[:120]}")
    if check and r.returncode: raise RuntimeError(f"cmd failed rc={r.returncode}: {str(cmd)[:160]} :: {r.stderr[-600:]}")
    return r
