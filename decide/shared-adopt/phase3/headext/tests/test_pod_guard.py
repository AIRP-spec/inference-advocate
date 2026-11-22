"""R-16 item 3: the driver-side cap fires even when the main thread is blocked (hx-t16). No pod, no network, no RunPod call: terminate_fn / pods_fn are stubs."""
import re, subprocess, threading, time
from pathlib import Path

import pytest
import pod_guard as PG

H = Path(__file__).resolve().parents[1]
DRV = (H / "headext_pod_train.py").read_text()


def make(deadline_in, **kw):
    state = {"alive": True, "terms": []}
    def term(pid):
        state["terms"].append(time.time())
        if len(state["terms"]) >= kw.get("die_after", 1): state["alive"] = False
    def pods(): return [{"id": "P"}] if state["alive"] else []
    g = PG.PodGuard("P", time.time() + deadline_in, term, pods, log=lambda *a: None, poll_s=0.2, retry_s=0.2, give_up_s=5)
    return g, state


def test_guard_terminates_at_deadline_while_main_thread_is_blocked():
    g, st = make(1.5); t0 = time.time(); g.start()
    time.sleep(3)            # main thread "blocked" (stands in for pull() stuck in a VPS pipe); the guard thread does not need it
    assert g.fired_at is not None and g.gone_at is not None and len(st["terms"]) == 1
    assert 1.4 <= g.fired_at - t0 <= 2.2


def test_guard_retries_terminate_until_pod_is_gone():
    g, st = make(0.5, die_after=3); g.start(); time.sleep(3)
    assert len(st["terms"]) == 3 and g.gone_at is not None


def test_guard_records_gone_when_pod_vanishes_before_deadline_and_does_not_terminate():
    g, st = make(30); g.start(); time.sleep(0.5); st["alive"] = False; time.sleep(0.8)
    assert g.gone_at is not None and g.fired_at is None and st["terms"] == []


def test_guard_poll_error_is_not_gone():
    def pods(): raise TimeoutError("read timed out")
    g = PG.PodGuard("P", time.time() + 0.6, lambda pid: None, pods, log=lambda *a: None, poll_s=0.1, retry_s=0.1, give_up_s=0.5); g.start(); time.sleep(0.4)
    assert g.gone_at is None


def test_guard_pod_not_found_counts_as_gone():
    def term(pid): raise RuntimeError('[{"message": "pod not found to terminate", "extensions": {"code": "POD_NOT_FOUND"}}]')
    g = PG.PodGuard("P", time.time() + 0.3, term, lambda: [{"id": "P"}], log=lambda *a: None, poll_s=0.1, retry_s=0.1, give_up_s=3); g.start(); time.sleep(1.2)
    assert g.gone_at is not None


def test_run_capped_is_bounded_by_the_deadline_not_by_the_command():
    t0 = time.time()
    with pytest.raises(PG.CapExceeded): PG.run_capped("sleep 60", time.time() + 1.5, per_call=600)
    assert time.time() - t0 < 4


def test_run_capped_ssh_255_retries_cannot_outlive_the_deadline():
    t0 = time.time()
    with pytest.raises(PG.CapExceeded): PG.run_capped("sh -c 'sleep 0.2; exit 255'", time.time() + 1.5, per_call=600, retries=50, sleep=lambda s: time.sleep(min(s, 0.3)))
    assert time.time() - t0 < 4


def test_run_capped_normal_and_failure_paths():
    assert PG.run_capped("echo hi", time.time() + 5).stdout == "hi\n"
    with pytest.raises(RuntimeError, match="rc=3"): PG.run_capped("exit 3", time.time() + 5)
    assert PG.run_capped("exit 3", time.time() + 5, check=False).returncode == 3


def test_driver_main_thread_pull_path_cannot_block_past_the_deadline(monkeypatch):
    """hx-t16 reproduction: vps_pipe (as called by pull) on a hanging VPS pipe. Before R-16 this blocked ~3 h; now it raises at the cap."""
    import importlib, sys
    m = sys.modules.get("headext_pod_train")   # another test in the suite can leave the wt-p3 copy of this module cached; use this checkout's
    if m is not None and Path(m.__file__).resolve() != (H / "headext_pod_train.py").resolve(): del sys.modules["headext_pod_train"]
    sys.path.insert(0, str(H)); D = importlib.import_module("headext_pod_train")
    g, st = make(2.0); D.GUARD[0] = g; monkeypatch.setattr(D, "PULL_MARGIN_S", 0.5); monkeypatch.setattr(D, "log", lambda *a: None)
    t0 = time.time()
    try:
        with pytest.raises(PG.CapExceeded): D.vps_pipe("sleep 600")
    finally: D.GUARD[0] = None
    assert time.time() - t0 < 4.5


def test_weights_pusher_is_not_capped_and_main_thread_paths_are():
    assert re.search(r"vps_pipe\(f\"cd \{d\} && tar cf - keep SHA256SUMS\.weights.*capped=False", DRV)
    pull = DRV[DRV.index("    def pull(R):"):DRV.index("    WQ = []; WDONE = {}")]
    assert "A.sh(" not in pull and "A.vps(" not in pull and "vps_pipe(" in pull and "csh(" in pull
    fin = DRV[DRV.index("    finally:"):]
    assert "A.sh(" not in fin and "A.vps(" not in fin.replace("A.vps(f\"echo", "")  # archive path uses bounded csh/cvps (final=True)
    assert "PG.PodGuard(pid, deadline, rp.terminate, rp.pods" in DRV and "GUARD[0].gone_at" in DRV
    assert "t_end = t_gone or t1" in DRV and "POD_NOT_FOUND" in DRV


def test_hx_t16_arithmetic():
    """pod seen gone ~23:18Z: 105 min x $0.89/h = $1.56; balance drop 33.315 -> 31.718 = $1.597; the old ledger cost used the driver's 252.9 min."""
    assert round(0.89 * 105 / 60, 3) == 1.558 and round(33.315 - 31.718, 3) == 1.597 and round(0.89 * 252.9426 / 60, 3) == 3.752
