"""Head-extension training pod (sizing addendum §8 A8; amendment t221u): ONE RTX 4090 SECURE pod, 5 seeds, cap = min(90 min,
$3 at the pod's rate). Runs pack/pod_pipeline_hx.sh (P3-3 recipe, 25 heads, data-v10 pinned). Validation predictions only;
nothing is scored here. After each seed's RUN_DONE the driver copies that seed's outputs (logs, raw val predictions,
average meta, final + ep2.0-4.0 average weights, sha files) pod -> box (sha256sum -c) and the outputs + predictions -> VPS
(sha256sum -c) while the next seed trains; weights (~1.7 GB/seed, box-verified) follow to the VPS in a background queue
(box->VPS ~4 MB/s) that may finish after terminate. Box + in-pod
watchdogs. On any failure: archive what exists (sha256sum -c) and terminate within 15 min. Base model is public (no token).
  python3 headext_pod_train.py --signed <commit> --pack TGZ --pack-sha S --seeds "60 61 62 63 64" --name hx-t1"""
import argparse, hashlib, json, os, shlex, subprocess, sys, threading, time, urllib.request

sys.path.insert(0, "/workspace/airp/decide/step4/scripts")
import rp  # noqa: E402
import headext_pod_a25 as A  # shared helpers (sh, vps, gq, balance, ledger_spent, ssh_base, rest_pods, sha)

HERE = os.path.dirname(os.path.abspath(__file__))
GPU = "NVIDIA GeForce RTX 4090"
IMAGE = "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04"
CAP_USD, CAP_MIN = 6.0, 105.0         # t227u item 4 ($6 per pod); t228u item 3: watchdog 105 min
DC = "EU-RO-1"            # t228u item 2: the only datacenter with SECURE RTX 4090 stock (2026-11-04); network volume lives here
VOL_MOUNT = "/vol"
CREATE_MUTATION = "podFindAndDeployOnDemand"   # t228u item 1: on-demand only, never interruptible / spot / bid
STOP_LINE, CEILING = 45.0, 60.0       # t227u item 5: $45 = one-line note, continue; abort only past $60
TRAIN_SHA = None; VAL_SHA = None
CREATE_TRIES = 30       # one try a minute for up to 30 min (no pod, no bill while supply-constrained)
CLOSE_S = 8 * 60          # stop the pipeline this long before the deadline to archive the last seed and terminate


def log(*a):
    s = time.strftime("%H:%M:%S") + " " + " ".join(str(x) for x in a)
    print(s, flush=True); LOG.write(s + "\n"); LOG.flush()


def status(msg): subprocess.run(["/workspace/xside/status.sh", msg], capture_output=True, text=True)


def precheck(signed, pack_sha):
    pins = json.load(open(A.PINS))
    pods = A.gq("query { myself { pods { id name } } }")["myself"]["pods"]; rpods = A.rest_pods()
    box = int(A.sh("df -BG --output=avail /workspace | tail -1").stdout.strip().rstrip("G"))
    vfree = int(A.vps("df -BG --output=avail / | tail -1").stdout.strip().rstrip("G"))
    b = A.balance(); cum = A.SPENT_BEFORE_LEDGER + A.ledger_spent()
    anc = A.sh(f"cd {A.REPO_WT} && git fetch -q origin plan/phase3-recipe-stability && git merge-base --is-ancestor {signed} origin/plan/phase3-recipe-stability", check=False).returncode == 0
    clean = A.sh(f"cd {A.REPO_WT} && git diff --quiet {signed} -- {A.REL}", check=False).returncode == 0
    files_ok = {f: A.sha(os.path.join(HERE, f)) == s for f, s in pins["files"].items()}
    log(f"PRECHECK (headroom): pods(gql)={len(pods)} pods(rest)={rpods} box_free={box}G vps_free={vfree}G balance=${b['clientBalance']:.2f} "
        f"cumulative=${cum:.2f} +cap ${CAP_USD} -> ${cum + CAP_USD:.2f} (stop line ${STOP_LINE}) signed_on_remote={anc} code_clean={clean} "
        f"pins_ok={all(files_ok.values())} pack_sha_ok={pack_sha}")
    if pods or rpods: raise SystemExit("ABORT: a pod is already running")
    if cum + CAP_USD > CEILING: raise SystemExit("ABORT: would pass the $60 ceiling")
    if cum + CAP_USD > STOP_LINE: log(f"NOTE ($45 line, t227u item 5): cumulative ${cum:.2f} + cap ${CAP_USD} may pass $45; pre-authorized through $60; continuing")
    if not anc or not clean: raise SystemExit("ABORT: signed commit not on remote or working tree differs")
    if not all(files_ok.values()): raise SystemExit(f"ABORT: pinned file sha mismatch {[f for f, v in files_ok.items() if not v]}")
    if box < 20 or vfree < 20: raise SystemExit("ABORT: disk headroom < 20 GB")
    if b["clientBalance"] < 10 or b["clientBalance"] - CAP_USD < 10: raise SystemExit("ABORT: low balance")
    if not pack_sha: raise SystemExit("ABORT: pack sha")
    return b["clientBalance"], cum


def vps_pipe(cmd, **kw):
    """box -> VPS tar pipe with retry: a transient 'server not responding' on the VPS failed hx-t5 (t228u) after 5 seeds."""
    for i in range(5):
        r = A.sh(cmd, check=False, **kw)
        if r.returncode == 0: return r
        log(f"VPS pipe retry {i + 1}/4 rc={r.returncode}:", r.stderr[-160:].replace("\n", " ")); time.sleep(30 * 2 ** i)  # 30, 60, 120, 240 s backoff
    raise RuntimeError(f"VPS pipe failed 5x: {cmd[:120]}")


def rstatus(pid):
    """rp.status with retry: a transient SSL EOF on the status poll failed hx-t2 (t227u) 30 s after create."""
    for i in range(6):
        try: return rp.status(pid)
        except Exception as e:
            if i == 5: raise
            log(f"status poll retry {i + 1}/5:", repr(e)[:120]); time.sleep(10)


def assert_on_demand_request(mutation, inp):
    """t228u item 1 (standing): refuse anything but an on-demand SECURE request."""
    bad = [k for k in inp if "bid" in k.lower() or "interrupt" in k.lower() or "spot" in k.lower()]
    if mutation != "podFindAndDeployOnDemand" or bad or inp.get("cloudType") != "SECURE":
        raise SystemExit(f"ABORT: pod request is not on-demand SECURE (mutation={mutation} keys={bad} cloud={inp.get('cloudType')})")


def assert_on_demand_pod(pid):
    """After create: the pod record must not be interruptible. Returns the podType string for the log."""
    p = A.gq('query { pod(input:{podId:"%s"}) { id podType machine { secureCloud } } }' % pid)["pod"] or {}
    pt = str(p.get("podType")); sec = (p.get("machine") or {}).get("secureCloud")
    if any(x in pt.upper() for x in ("INTERRUPT", "SPOT", "BID")) or sec is False:
        raise RuntimeError(f"pod {pid} is not on-demand SECURE (podType={pt} secureCloud={sec})")
    return pt, sec


def main():
    ap = argparse.ArgumentParser()
    for x in ("--signed", "--pack", "--pack-sha", "--seeds", "--name", "--train-sha", "--val-sha"): ap.add_argument(x, required=True)
    ap.add_argument("--volume-id", required=True, help="t228u item 2: RunPod network volume (in DC) mounted at /vol; each seed's "
                    "artifacts + MANIFEST.sha256 are written there by the pipeline as the seed finishes")
    ap.add_argument("--label", default="training pod", help="ledger description prefix")
    ap.add_argument("--cap-usd", type=float, default=None, help="override CAP_USD (short pod headroom); default module CAP_USD")
    ap.add_argument("--attach", action="store_true", help="re-attach to the running pod in state.json (driver restart): "
                    "no create, no upload, no launch; verify both watchdogs, then monitor / archive / terminate")
    ap.add_argument("--local-pull-test", help="box test of the per-seed archive path on a finished local work dir; no pod")
    a = ap.parse_args()
    global CAP_USD
    if a.cap_usd is not None:
        if not (0.5 <= a.cap_usd <= CAP_USD): raise SystemExit(f"ABORT: --cap-usd {a.cap_usd} out of range")
        CAP_USD = float(a.cap_usd); log(f"CAP_USD override -> {CAP_USD}")
    PODW = a.local_pull_test or "/root/hx"
    NAME = a.name; ROOT = f"/workspace/headext-train/{NAME}"; OUT = f"{ROOT}/out"; VD = f"{A.VPSDIR}/train-{NAME}"
    os.makedirs(f"{OUT}/logs", exist_ok=True)
    if not a.attach and os.listdir(f"{OUT}/logs") or not a.attach and A.vps(f"test -e {VD}", check=False).returncode == 0: raise SystemExit("ABORT: output exists (no silent resume)")
    if a.attach:
        st = json.load(open(f"{ROOT}/state.json")); pid, rate, t0, deadline, bal0 = st["pod"], st["rate"], st["t0"], st["deadline"], st["bal0"]
        log(f"ATTACH {pid} rate=${rate}/h deadline={time.strftime('%H:%M:%S', time.localtime(deadline))}")
    elif a.local_pull_test:
        VD = f"{A.VPSDIR}/train-{NAME}"; bal0 = 0; pid = "local"; rate = 0; t0 = time.time(); deadline = t0 + 3600
    else:
        bal0, cum0 = precheck(a.signed, A.sha(a.pack) == a.pack_sha)
        pub = open(A.KEY + ".pub").read().strip()
        inp = {"cloudType": "SECURE", "gpuCount": 1, "volumeInGb": 0, "containerDiskInGb": 60, "minVcpuCount": 8, "minMemoryInGb": 30,
               "gpuTypeId": GPU, "name": NAME, "imageName": IMAGE, "ports": "22/tcp", "startSsh": True, "env": [{"key": "PUBLIC_KEY", "value": pub}],
               "dataCenterId": DC, "networkVolumeId": a.volume_id, "volumeMountPath": VOL_MOUNT}
        assert_on_demand_request(CREATE_MUTATION, inp)
        pod = None
        for k in range(CREATE_TRIES):  # SUPPLY_CONSTRAINT: nothing is created or billed; retry once a minute
            try:
                pod = rp.gql("mutation($i: PodFindAndDeployOnDemandInput) { " + CREATE_MUTATION + "(input: $i) { id name costPerHr machine { gpuTypeId } } }", {"i": inp})[CREATE_MUTATION]
                break
            except Exception as e:
                log(f"create attempt {k + 1}/{CREATE_TRIES} failed:", repr(e)[:160])
                msg = repr(e)
                # RunPod may say SUPPLY_CONSTRAINT or "does not have the resources" / "try a different machine"
                supply = ("SUPPLY_CONSTRAINT" in msg
                          or "does not have the resources" in msg
                          or "try a different machine" in msg)
                if not supply or k == CREATE_TRIES - 1:
                    status(f"headext {NAME} POD NOT CREATED (no RTX 4090 SECURE after {k + 1} tries); nothing billed; stopped")
                    raise SystemExit("ABORT: no GPU")
                if A.gq("query { myself { pods { id name } } }")["myself"]["pods"]: raise SystemExit("ABORT: a pod appeared during retries")
                time.sleep(60)
        pid, rate = pod["id"], float(pod["costPerHr"]); t0 = time.time()
        cap_s = min(CAP_MIN * 60, CAP_USD / rate * 3600); deadline = t0 + cap_s
        log(f"POD CREATED {pid} gpu={pod['machine']['gpuTypeId']} rate=${rate}/h cap={cap_s/60:.1f}min (${CAP_USD}) seeds=[{a.seeds}]")
        try: ptype = assert_on_demand_pod(pid); log(f"ON-DEMAND CHECK OK podType={ptype[0]} secureCloud={ptype[1]} dc={DC} volume={a.volume_id}")
        except Exception as e:
            log("ON-DEMAND CHECK FAILED:", repr(e)[:300]); rp.terminate(pid); log(f"TERMINATED {pid} (not on-demand)"); raise SystemExit("ABORT: not on-demand")
        json.dump({"pod": pid, "rate": rate, "t0": t0, "deadline": deadline, "bal0": bal0, "signed": a.signed}, open(f"{ROOT}/state.json", "w"))
        subprocess.Popen(["nohup", "python3", "/workspace/v3collect/watchdog.py", pid, str(deadline)],
                         stdout=open(f"{ROOT}/watchdog.log", "a"), stderr=subprocess.STDOUT, start_new_session=True)
        status(f"headext training {NAME} POD {pid} created ({GPU}, ${rate}/h, SECURE); seeds {a.seeds}; cap {cap_s/60:.0f} min / ${CAP_USD}; box watchdog started")
    res = {"seeds": {s: "not_started" for s in a.seeds.split()}}; t_fail = None
    pulled = set(); seeds = a.seeds.split()
    S = None

    def pull(R):
        """pod -> box -> VPS for one finished seed; verified on the VPS with sha256sum -c."""
        d = f"{OUT}/{R}"; os.makedirs(d, exist_ok=True)
        paths = f"out/raw/{R} out/raw-avg/{R} out/avg-meta/avg-{R}-ge2.0.average-meta.json out/{R}.sha256 keep/{R}-final keep/avg-{R}-ge2.0 keep/{R}-final.sha256"
        logs = f"logs/train-{R}.log logs/training-meta-{R}.json logs/loss_curve-{R}.jsonl logs/infer-{R}.log logs/avg-{R}.log logs/infer-avg-{R}.log"
        A.sh(" ".join(shlex.quote(x) for x in S) + f" 'cd {PODW} && tar cf - {paths} {logs}' | tar xf - -C {d}")
        r1 = A.sh(f"cd {d} && sha256sum -c --quiet out/{R}.sha256 && cd keep && sha256sum -c --quiet {R}-final.sha256", check=False)
        if r1.returncode: raise RuntimeError(f"box sha256sum -c failed for {R}")
        files = sorted(os.path.relpath(os.path.join(dp, f), d) for dp, _, fs in os.walk(d) for f in fs if not f.startswith("SHA256SUMS"))
        small = [f for f in files if not f.startswith("keep/")]; big = [f for f in files if f.startswith("keep/")]
        open(f"{d}/SHA256SUMS", "w").write("".join(f"{A.sha(f'{d}/{f}')}  {f}\n" for f in small))
        open(f"{d}/SHA256SUMS.weights", "w").write("".join(f"{A.sha(f'{d}/{f}')}  {f}\n" for f in big))
        A.vps(f"mkdir -p {VD}/{R}")
        # predictions, logs, meta, sha files -> VPS now (verified); weights (box-verified) -> VPS in the background queue
        vps_pipe(f"cd {d} && tar cf - --exclude=./keep . | " + " ".join(shlex.quote(x) for x in A.VPSH) + f" 'cd {VD}/{R} && tar xf -'")
        r = A.vps(f"cd {VD}/{R} && sha256sum -c --quiet SHA256SUMS && echo ALLOK", check=False)
        if "ALLOK" not in r.stdout: raise RuntimeError(f"VPS sha256sum -c failed for {R}")
        log(f"ARCHIVED {R}: box {len(files)} files sha256sum -c OK; VPS outputs+predictions {len(small)} files sha256sum -c OK -> {VD}/{R}; weights queued")
        pulled.add(R); res["seeds"][R[4:]] = "done_archived"; WQ.append(R)

    WQ = []; WDONE = {}

    def weights_pusher():
        while True:
            if WQ:
                R = WQ.pop(0); d = f"{OUT}/{R}"
                try:
                    vps_pipe(f"cd {d} && tar cf - keep SHA256SUMS.weights | " + " ".join(shlex.quote(x) for x in A.VPSH) + f" 'cd {VD}/{R} && tar xf -'", timeout=3600)
                    r = A.vps(f"cd {VD}/{R} && sha256sum -c --quiet SHA256SUMS.weights && echo ALLOK", check=False)
                    WDONE[R] = "ALLOK" in r.stdout
                except Exception as e: WDONE[R] = False; log(f"weights push {R} failed:", repr(e)[:200])
                log(f"WEIGHTS {R} -> VPS sha256sum -c {'OK' if WDONE[R] else 'FAILED'}")
            elif STOPW[0]: return
            else: time.sleep(5)
    STOPW = [False]; wt = threading.Thread(target=weights_pusher, daemon=True); wt.start()

    if a.local_pull_test:
        S = ["bash", "-c"]
        for sd in seeds: pull(f"hx-s{sd}")
        STOPW[0] = True; wt.join(); log(f"LOCAL PULL TEST seeds={sorted(pulled)} weights={WDONE}"); return

    try:
        ip = port = None
        for _ in range(90):
            s = rstatus(pid)
            for p in ((s or {}).get("runtime") or {}).get("ports") or []:
                if p["privatePort"] == 22 and p["isIpPublic"]: ip, port = p["ip"], p["publicPort"]
            if ip: break
            time.sleep(10)
        if not ip: raise RuntimeError("no ssh port after 15 min")
        S = A.ssh_base(ip, port)
        for _ in range(30):
            if A.sh(S + ["true"], check=False).returncode == 0: break
            time.sleep(10)
        if a.attach:
            wd = A.sh(S + ["pgrep -f 'bash /root/wd.sh' >/dev/null && echo wd_running; pgrep -f pod_pipeline_hx.sh >/dev/null && echo pipe_running"]).stdout
            log("ATTACH CHECK:", wd.replace("\n", " | "))
            if "wd_running" not in wd: raise RuntimeError("in-pod watchdog not running")
        else:
            remain = int(deadline - time.time() - 60)
            A.sh(S + [f"cat > /root/wd.sh <<'EOF'\n. /etc/rp_environment\nsleep {remain}\nrunpodctl remove pod $RUNPOD_POD_ID\nEOF"])
            wd = A.sh(S + ["nohup bash /root/wd.sh >/root/wd.log 2>&1 & sleep 1; pgrep -f 'bash /root/wd.sh' >/dev/null && echo wd_running; "
                           ". /etc/rp_environment; [ -n \"$RUNPOD_POD_ID\" ] && echo has_pod_id; which runpodctl >/dev/null && echo has_runpodctl; "
                           "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader; df -BG --output=avail / | tail -1"]).stdout
            log("IN-POD WATCHDOG + GPU:", wd.replace("\n", " | "))
            if "wd_running" not in wd or "has_runpodctl" not in wd: raise RuntimeError("in-pod watchdog not running")
            A.sh(f"cat {shlex.quote(a.pack)} | " + " ".join(shlex.quote(x) for x in S) + " 'mkdir -p /root/hx && tar xzf - -C /root/hx'")
            log("PACK UPLOADED", A.sh(S + ["cd /root/hx && sha256sum -c --quiet PACK.sha256 && echo PACK_OK; sha256sum PACK.sha256"]).stdout.replace("\n", " "))
            # hx-t4: this ssh hung (pipeline ran); bounded now, then the pipeline is checked directly
            try:
                A.sh(S[:1] + ["-n"] + S[1:] + [f"cd /root/hx && mountpoint -q {VOL_MOUNT} && mkdir -p {VOL_MOUNT}/{NAME} && setsid nohup sh -c 'SEEDS=\"{a.seeds}\" TRAIN_SHA={a.train_sha} VAL_SHA={a.val_sha} VOL={VOL_MOUNT}/{NAME} W=/root/hx bash pod_pipeline_hx.sh "
                          f"> /root/hx/pipe.log 2>&1; echo PIPE_EXIT $? >> /root/hx/pipe.log' </dev/null >/dev/null 2>&1 &"], timeout=90)
            except subprocess.TimeoutExpired: log("start ssh timed out after 90 s; checking the pipeline directly")
            time.sleep(5)
            chk = A.sh(S + [f"pgrep -f pod_pipeline_hx.sh >/dev/null && echo pipe_running; mountpoint -q {VOL_MOUNT} && echo vol_mounted"], check=False).stdout
            if "pipe_running" not in chk or "vol_mounted" not in chk: raise RuntimeError(f"pipeline/volume not up: {chk!r}")
            log("PIPELINE STARTED")
        seen = set()
        while True:
            time.sleep(30)
            st = A.sh(S + ["grep -aE '^(RUN_START|RUN_DONE_|VOL_OK_|HEADINIT_OK|PIPELINE_DONE|PIPE_EXIT|PREPROCESS_DONE|ALL [0-9]+ PASS|ENCODER_ATTN|SMOKE_BF16_MIXED|\\[(train|val)\\])|STOP|FAIL|BAD|SKIPPED|skip nonfinite' /root/hx/pipe.log"], check=False).stdout
            for ln in st.splitlines():
                if ln not in seen: seen.add(ln); log("POD:", ln[:300])
            for sd in seeds:
                R = f"hx-s{sd}"
                if f"RUN_DONE_{R}" in st and R not in pulled:
                    if f"VOL_OK_{R}" not in st: raise RuntimeError(f"{R} done without VOL_OK (network-volume write not verified)")
                    pull(R)
                elif f"RUN_START {R}" in st and R not in pulled: res["seeds"][sd] = "running"
            # bash -x echoes the pipeline's own `+ grep -q SKIPPED_NONFINITE ...` check; that echo failed hx-t4 (t227u) with
            # skips=0. Only non-xtrace lines count.
            st_real = "\n".join(l for l in st.splitlines() if not l.startswith("+"))
            if "SKIPPED_NONFINITE" in st_real or "skip nonfinite" in st_real or "SKIPPED_MICROBATCH_STOP" in st_real:
                raise RuntimeError("skipped micro-batch (A30: must be 0)")
            if "PIPELINE_DONE" in st: break
            if "PIPE_EXIT" in st: raise RuntimeError("pipeline exited without PIPELINE_DONE")
            if time.time() > deadline - CLOSE_S: raise RuntimeError("time cap reached before PIPELINE_DONE")
        missing = [s for s in seeds if f"hx-s{s}" not in pulled]
        if missing: raise RuntimeError(f"seeds not archived: {missing}")
        # t228u: terminate only after every seed's weights are verified on the VPS (outputs/manifests already are)
        while (WQ or len(WDONE) < len(pulled)) and time.time() < deadline - 90: time.sleep(10)
        if not all(WDONE.get(f"hx-s{s}") for s in seeds): raise RuntimeError(f"weights not VPS-verified before cap: {WDONE}")
        log("ALL SEEDS VPS-VERIFIED (outputs + weights):", sorted(WDONE))
    except Exception as e:
        t_fail = time.time()
        log("FAILURE:", repr(e)[:1500]); res["failure"] = repr(e)[:300]
        status(f"FAILURE on headext training pod {pid}: {repr(e)[:200]} - archiving what exists and terminating now")
        if S:
            try: A.sh(S + ["pkill -f pod_pipeline_hx.sh; pkill -f train_shared.py; pkill -f infer_raw_shared.py; true"], check=False, timeout=60)
            except Exception: pass
    finally:
        try:
            if S:
                A.sh(" ".join(shlex.quote(x) for x in S) + f" 'cd /root/hx && tar cf - pipe.log logs/preprocess.log pre/preprocess-meta.json 2>/dev/null' | tar xf - -C {OUT}/logs", check=False, timeout=300)
        except Exception as e: log("log pull failed:", repr(e)[:200])
        for sd in seeds:  # a seed that finished just before a failure: still try to archive it (time permitting)
            R = f"hx-s{sd}"
            if R not in pulled and os.path.exists(f"{OUT}/logs/pipe.log") and f"RUN_DONE_{R}" in open(f"{OUT}/logs/pipe.log").read() \
                    and (t_fail is None or time.time() - t_fail < 8 * 60) and time.time() < deadline - 120:
                try: pull(R)
                except Exception as e: log(f"late pull {R} failed:", repr(e)[:200]); res["seeds"][sd] = "done_not_archived"
        for sd in seeds:
            if res["seeds"][sd] == "running": res["seeds"][sd] = "incomplete"
        try:
            files = sorted(os.path.relpath(os.path.join(dp, f), f"{OUT}/logs") for dp, _, fs in os.walk(f"{OUT}/logs") for f in fs if f != "SHA256SUMS")
            open(f"{OUT}/logs/SHA256SUMS", "w").write("".join(f"{A.sha(f'{OUT}/logs/{f}')}  {f}\n" for f in files))
            A.vps(f"mkdir -p {VD}/logs"); A.sh(f"cd {OUT}/logs && tar cf - . | " + " ".join(shlex.quote(x) for x in A.VPSH) + f" 'cd {VD}/logs && tar xf -'")
            r = A.vps(f"cd {VD}/logs && sha256sum -c --quiet SHA256SUMS && echo ALLOK", check=False); log("ARCHIVE logs:", "OK" if "ALLOK" in r.stdout else "FAILED")
        except Exception as e: log("log archive failed:", repr(e)[:200])
        for i in range(5):
            try: rp.terminate(pid); break
            except Exception as e: log("terminate retry", repr(e)[:200]); time.sleep(10)
        t1 = time.time(); time.sleep(25)
        allp = A.gq("query { myself { pods { id name } } }")["myself"]["pods"]
        try: rpods = A.rest_pods()
        except Exception as e: rpods = f"rest error {repr(e)[:100]}"
        bal1 = A.balance()["clientBalance"]; cost = max(rate * (t1 - t0) / 3600, bal0 - bal1)
        log(f"TERMINATED {pid} pod_list_after(gql)={allp} rest={rpods} minutes={(t1-t0)/60:.1f} balance {bal0:.3f}->{bal1:.3f} cost=${cost:.3f}"
            + (f" terminate_after_failure={(t1 - t_fail)/60:.1f}min" if t_fail else ""))
        row = "\t".join(str(x) for x in [NAME, pid, GPU, rate, time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(t0)),
            time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(t1)), f"{bal0:.3f}", f"{bal1:.3f}", f"{cost:.3f}",
            f"headext {a.label} (t228u, eager, vol {a.volume_id}) seeds {a.seeds} data-v10 25 heads; seeds_archived:{len(pulled)} failure:{bool(res.get('failure'))}"])
        A.vps(f"echo {shlex.quote(row)} >> {A.LEDGER}")
        tot = A.SPENT_BEFORE_LEDGER + A.ledger_spent()
        out = {"pod": pid, "rate": rate, "cost": cost, "bal0": bal0, "bal1": bal1, "pod_list_after": allp, "rest_pods_after": rpods,
               "cumulative": tot, "minutes": (t1 - t0) / 60, "signed": a.signed, "t0": t0, "t1": t1, **res}
        json.dump(out, open(f"{ROOT}/result.json", "w"), indent=1, default=str)
        STOPW[0] = True; wt.join(timeout=3 * 3600)
        out["weights_vps_verified"] = WDONE; json.dump(out, open(f"{ROOT}/result.json", "w"), indent=1, default=str)
        status(f"headext training {NAME} TERMINATED {pid} after {(t1-t0)/60:.1f} min; pods={len(allp)}; cost ${cost:.2f}; bal ${bal1:.2f}; "
               f"cum ${tot:.2f}; seeds archived {len(pulled)}/{len(seeds)}; weights on VPS {sum(WDONE.values())}/{len(pulled)}")


if __name__ == "__main__":
    ap0 = argparse.ArgumentParser(add_help=False); ap0.add_argument("--name", required=True); n = ap0.parse_known_args()[0].name
    os.makedirs(f"/workspace/headext-train/{n}", exist_ok=True)
    LOG = open(f"/workspace/headext-train/{n}/driver.log", "a")
    main()
