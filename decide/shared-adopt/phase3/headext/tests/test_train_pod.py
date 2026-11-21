"""Training pod one (t221u): the pipeline carries the §8 recipe exactly; the driver's caps and GPU match A8."""
import re
from pathlib import Path

H = Path(__file__).resolve().parents[1]
PIPE = (H / "pack/pod_pipeline_hx.sh").read_text()
DRV = (H / "headext_pod_train.py").read_text()


def test_recipe_flags():
    train = PIPE[PIPE.index("train_shared.py --train-items"):PIPE.index("logs/train-$R.log")]
    for f in ("--epochs 4", "--eta-min 0", "--head-init-seed 7", "--batch-size 8", "--grad-accum 4", "--lr-encoder 2e-5",
              "--lr-head 1e-4", "--sigma-start 0.25", "--soft-mix 0.5", "--soft-partial", "--ext-heads 8", "--seed $SEED"):
        assert f in train, f
    assert "ens5-train-soft-v9.jsonl" in PIPE and "AMP=bf16" in PIPE


def test_average_window_and_headinit():
    assert "for e in 2.0 2.5 3.0 3.5 4.0" in PIPE
    assert "BASE_SHA=10a35c7911392632d212b188849fae39fd9fe583252eb07ba27873d0c17106c5" in PIPE
    assert "HEADINIT25_DIFFERS_STOP" in PIPE and "HEADINIT_MISMATCH_STOP" in PIPE


def test_validation_only_no_scoring():
    assert "--val $VAL" in PIPE and "empty-suite.json" in PIPE
    assert not re.search(r"score|v3-|condition", PIPE.replace("V3", "")), "pipeline must not score or touch v3 sets"


def test_caps_and_gpu():
    assert 'CAP_USD, CAP_MIN = 6.0, 105.0' in DRV and 'assert_on_demand_request(CREATE_MUTATION, inp)' in DRV and 'CREATE_MUTATION = "podFindAndDeployOnDemand"' in DRV and 'GPU = "NVIDIA GeForce RTX 4090"' in DRV and '"SECURE"' in DRV
    assert "STOP_LINE, CEILING = 85.0, 100.0" in DRV and "cum + CAP_USD > CEILING" in DRV and "skipped micro-batch" in DRV and "watchdog.py" in DRV and "wd.sh" in DRV


def test_a30_eager_smoke_and_skip_guard():
    assert "export AIRP_ATTN_IMPL=eager" in PIPE and "--max-skipped 0" in PIPE
    assert "smoke_bf16_mixed.py" in PIPE and "--require-finite eager" in PIPE and "exit 17" in PIPE
    assert "SKIPPED_MICROBATCH_STOP" in PIPE and "m['skipped_nonfinite']==0" in PIPE and "ATTN_NOT_EAGER_STOP" in PIPE
    assert PIPE.index("smoke_bf16_mixed.py") < PIPE.index("train_shared.py --train-items")



def test_tracked_primitives_out_precheck_source():
    """t238u: standing pre-pod check restores and requires the four tracked primitives/out files."""
    assert "git" in DRV and "checkout" in DRV and "tools/evaluator-training/primitives/out/" in DRV
    assert "ensure_tracked_primitives_out" in DRV
    for f in ("primitives-labels.jsonl", "sft-primitives-v4.jsonl", "test-labels.jsonl", "test-sft-v4.jsonl"):
        assert f"tools/evaluator-training/primitives/out/{f}" in DRV
    assert "ABORT: tracked primitives/out files still missing after checkout" in DRV
    # called from precheck, before a pod is created
    assert DRV.index("def ensure_tracked_primitives_out") < DRV.index("def precheck")
    assert "out_files = ensure_tracked_primitives_out" in DRV[DRV.index("def precheck"):DRV.index("if pods:")]


def test_ensure_tracked_primitives_out_restores_and_rejects_missing(tmp_path):
    import os, subprocess, sys
    sys.path.insert(0, str(H))
    import headext_pod_train as tr
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.email", "t238u@test"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.name", "t238u"], cwd=repo, check=True)
    out = repo / "tools/evaluator-training/primitives/out"
    out.mkdir(parents=True)
    names = [Path(p).name for p in tr.TRACKED_PRIMITIVES_OUT]
    for n in names:
        (out / n).write_text(f"{n}\n")
    subprocess.run(["git", "add", "tools/evaluator-training/primitives/out"], cwd=repo, check=True)
    subprocess.run(["git", "commit", "-q", "-m", "out"], cwd=repo, check=True)
    for n in names:
        (out / n).unlink()
    assert not any((out / n).is_file() for n in names)
    got = tr.ensure_tracked_primitives_out(str(repo))
    assert got == list(tr.TRACKED_PRIMITIVES_OUT)
    assert all((out / n).is_file() and (out / n).stat().st_size > 0 for n in names)
    # empty repo: checkout cannot restore untracked-missing files
    empty = tmp_path / "empty"
    empty.mkdir()
    subprocess.run(["git", "init", "-q"], cwd=empty, check=True)
    try:
        tr.ensure_tracked_primitives_out(str(empty))
    except SystemExit as e:
        msg = str(e)
        assert "ABORT:" in msg
        assert "checkout" in msg or "still missing" in msg
    else:
        raise AssertionError("expected SystemExit when the four files are not in the repo")


if __name__ == "__main__":
    fs = [test_recipe_flags, test_average_window_and_headinit, test_validation_only_no_scoring, test_caps_and_gpu, test_a30_eager_smoke_and_skip_guard, test_tracked_primitives_out_precheck_source]
    for f in fs: f(); print("PASS", f.__name__)


def test_r5_vol_prune_and_free_space_refusal(tmp_path):
    """R-5: deletion list is validated, each entry du -sh + rm -rf + logged; pipeline refused unless >=4 GB/seed and >=20 GB free."""
    import sys
    sys.path.insert(0, str(H))
    import pytest
    import headext_pod_train as tr
    # refusal rule
    assert tr.vol_required_gb(1) == 20 and tr.vol_required_gb(5) == 20 and tr.vol_required_gb(7) == 28
    assert not tr.vol_free_ok(19, 1) and tr.vol_free_ok(20, 1) and not tr.vol_free_ok(19, 5) and not tr.vol_free_ok(27, 7)
    # list validation: only /vol/<pod>/hx-s<NN>
    good = tmp_path / "good.txt"; good.write_text("# c\n/vol/hx-t5/hx-s60\n\n/vol/hx-t13/hx-s94\n")
    assert tr.parse_delete_list(str(good)) == ["/vol/hx-t5/hx-s60", "/vol/hx-t13/hx-s94"]
    for bad in ("/vol", "/vol/hx-t5", "/vol/hx-t5/hx-s60/keep", "/vol/../root/hx-s60", "/vol/hx-t5/*", "/root/hx-t5/hx-s60"):
        f = tmp_path / "bad.txt"; f.write_text(bad + "\n")
        with pytest.raises(SystemExit): tr.parse_delete_list(str(f))
    script = tr.vol_prep_script(["/vol/hx-t5/hx-s60"], 1)
    assert "du -sh" in script and "rm -rf" in script and "VOL_DEL " in script and "VOL_LOW_STOP" in script and "-lt 20" in script
    assert script.index("mountpoint -q /vol") < script.index("rm -rf") < script.index("VOL_LOW_STOP")
    # the driver raises into the normal terminate path when the prep script refuses, before the pipeline starts
    assert DRV.index("vol_prep_script(del_entries") < DRV.index("PIPELINE STARTED") and "VOL_LOW_STOP / volume prep failed" in DRV
    # behaviour of the generated shell on a fake mount: df reads 'free' via a stub
    import subprocess
    stub = tmp_path / "bin"; stub.mkdir()
    (stub / "mountpoint").write_text("#!/bin/sh\nexit 0\n"); (stub / "df").write_text("#!/bin/sh\necho Avail\necho 12G\n")
    (stub / "du").write_text("#!/bin/sh\nprintf '5G\\t/vol\\n'\n")
    for n in ("mountpoint", "df", "du"): (stub / n).chmod(0o755)
    r = subprocess.run(["bash", "-c", tr.vol_prep_script([], 1)], capture_output=True, text=True, env={"PATH": f"{stub}:/usr/bin:/bin"})
    assert r.returncode == 3 and "VOL_LOW_STOP 12" in r.stdout and "VOL_PREP_OK" not in r.stdout
    (stub / "df").write_text("#!/bin/sh\necho Avail\necho 30G\n")
    r = subprocess.run(["bash", "-c", tr.vol_prep_script([], 5)], capture_output=True, text=True, env={"PATH": f"{stub}:/usr/bin:/bin"})
    assert r.returncode == 0 and "VOL_PREP_OK" in r.stdout


def test_r5_quota_aware_free_space(tmp_path):
    """df in the pod reports the host fs (hundreds of TB); the guard must use quota - du, so a nearly full quota refuses."""
    import sys, subprocess
    sys.path.insert(0, str(H))
    import headext_pod_train as tr
    stub = tmp_path / "bin"; stub.mkdir()
    (stub / "mountpoint").write_text("#!/bin/sh\nexit 0\n"); (stub / "df").write_text("#!/bin/sh\necho Avail\necho 480256G\n")
    (stub / "du").write_text("#!/bin/sh\nprintf '55G\\t/vol\\n'\n")
    for n in ("mountpoint", "df", "du"): (stub / n).chmod(0o755)
    env = {"PATH": f"{stub}:/usr/bin:/bin"}
    r = subprocess.run(["bash", "-c", tr.vol_prep_script([], 5)], capture_output=True, text=True, env=env)
    assert r.returncode == 3 and "VOL_LOW_STOP 5" in r.stdout and "VOL_USED_GB 55" in r.stdout
    (stub / "du").write_text("#!/bin/sh\nprintf '24G\\t/vol\\n'\n")
    r = subprocess.run(["bash", "-c", tr.vol_prep_script([], 5)], capture_output=True, text=True, env=env)
    assert r.returncode == 0 and "VOL_FREE_AFTER 36" in r.stdout and "VOL_PREP_OK" in r.stdout
