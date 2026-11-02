"""Head-extension generation pod G1 (sizing addendum signed t217u; amendment 12). Derived from the v3-safety pod
(/workspace/v3safety/v3s_pod.py). ONE pod: Qwen3-30B-A3B-Instruct-2507 @0d7cf239 generates the pinned slot spec;
Seed-OSS-36B-Instruct @497f1dca labels every non-empty row (checker, delete-only); checker-delete removes, unviewed,
every row flagged CSE / eck / invalid / missing; interim V-a/V-e/V-f report. No G2, no checker-2, no training pod.
Never prints or reads row text: counts, ids and shas only. Box + in-pod watchdogs; cap = min(90 min, CAP_USD at the
pod's rate). Archive with SHA256SUMS + `sha256sum -c` on the VPS before terminate; pods=[] confirmed via GraphQL + REST.
  python3 headext_pod.py --signed <commit>        (run from the box; RunPod key in env)"""
import argparse, hashlib, json, os, shlex, subprocess, sys, threading, time, urllib.request

sys.path.insert(0, "/workspace/airp/decide/step4/scripts")
import rp  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_WT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
REL = os.path.relpath(HERE, REPO_WT)
V3 = "/workspace/evaluator-suite/v3"
ROOT = "/workspace/headext-g1"; NAME = "hx-g1"
GPU = "NVIDIA RTX PRO 6000 Blackwell Server Edition"
CAP_USD, CAP_MIN = 2.55, 90.0          # G1 share of the shared $4 generation cap (amendment 12)
STOP_LINE, CEILING = 45.0, 60.0
WRITER, CHECKER, CHECKER_FAMILY = "qwen3-30b-a3b-2507", "seed-oss-36b", "bytedance-seed"
GUIDE = "/workspace/xside/guide-e5b7b56c.md"
GUIDE_SHA = "e5b7b56cd466b2f503ad15178ef1b1b8d44a1dde20523898546ed3c4ceca6aa6"
VPSH = ["ssh", "-p", "2060", "-i", "/home/box/.ssh/nepal_vps_servetus", "-o", "StrictHostKeyChecking=no",
        "-o", "ServerAliveInterval=30", "root@203.134.250.85"]
VPSDIR = "/root/primitives-evaluator/headext-20261102"
LEDGER = "/root/primitives-evaluator/v3-collect-20261101/SPEND-LEDGER.tsv"
SPENT_BEFORE_LEDGER = 4.75
KEY = "/home/box/.ssh/runpod_airp"
OUT = ROOT + "/out-" + NAME
PINS = os.path.join(HERE, "HEADEXT-PINS.json")


def log(*a):
    s = time.strftime("%H:%M:%S") + " " + " ".join(str(x) for x in a)
    print(s, flush=True); LOG.write(s + "\n"); LOG.flush()
def status(msg): subprocess.run(["/workspace/xside/status.sh", msg], capture_output=True, text=True)
def sh(cmd, check=True, **kw):
    for i in range(6):
        r = subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True, **kw)
        if not (isinstance(cmd, list) and cmd[0] == "ssh" and r.returncode == 255): break
        time.sleep(10)
    if check and r.returncode: raise RuntimeError(f"cmd failed rc={r.returncode}: {str(cmd)[:160]} :: {r.stderr[-600:]}")
    return r
def vps(cmd, check=True): return sh(VPSH + [cmd], check=check)
def gq(*a):
    for i in range(6):
        try: return rp.gql(*a)
        except Exception:
            if i == 5: raise
            time.sleep(5)
def balance(): return gq("query { myself { clientBalance currentSpendPerHr } }")["myself"]
def ledger_spent():
    tot = 0.0
    for line in vps(f"cat {LEDGER}").stdout.splitlines()[1:]:
        f = line.split("\t")
        if len(f) > 8 and f[8] not in ("", "cost_usd"): tot += float(f[8])
    return tot
def sha(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()
def ssh_base(ip, port):
    return ["ssh", "-i", KEY, "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", "-o", "LogLevel=ERROR",
            "-o", "ServerAliveInterval=30", "-o", "ConnectTimeout=20", "-p", str(port), f"root@{ip}"]
def rest_pods():
    req = urllib.request.Request("https://rest.runpod.io/v1/pods", headers={"Authorization": "Bearer " + rp.key(), "User-Agent": "Mozilla/5.0 airp-hx"})
    return [p.get("id") for p in json.loads(urllib.request.urlopen(req, timeout=60).read())]


def arch():
    import shutil
    shutil.copyfile(f"{ROOT}/logs/{NAME}.log", f"{OUT}/logs/{NAME}.log.snapshot")
    if os.path.exists(f"{ROOT}/logs/{NAME}.result.json"):
        shutil.copyfile(f"{ROOT}/logs/{NAME}.result.json", f"{OUT}/logs/{NAME}.result.json")
    files = sorted(os.path.relpath(os.path.join(dp, f), OUT) for dp, _, fs in os.walk(OUT) for f in fs
                   if f != "SHA256SUMS" and not f.endswith(".tmp"))
    open(f"{OUT}/SHA256SUMS", "w").write("".join(f"{sha(f'{OUT}/{f}')}  {f}\n" for f in files))
    d = f"{VPSDIR}/out-{NAME}"; vps(f"mkdir -p {d}/logs")
    sh(f"cd {OUT} && tar cf - . | " + " ".join(shlex.quote(x) for x in VPSH) + f" 'cd {d} && tar xf -'")
    # rows deleted by checker-delete rewrite files (same names); remove any stale VPS file not in the manifest
    vps(f"cd {d} && find . -type f ! -name SHA256SUMS | sed 's|^./||' | sort > /tmp/hx-have && cut -c67- SHA256SUMS | sort > /tmp/hx-want && "
        f"comm -23 /tmp/hx-have /tmp/hx-want | while read f; do rm -f -- \"$f\"; done; true", check=False)
    r = vps(f"cd {d} && sha256sum -c SHA256SUMS", check=False)
    log(f"ARCHIVE {d}: sha256sum -c {r.stdout.count(': OK')}/{len(files)} OK rc={r.returncode}")
    if r.returncode: raise RuntimeError("archive verify failed")
    return r.stdout.count(": OK"), len(files)


def precheck(signed):
    pins = json.load(open(PINS))
    pods = gq("query { myself { pods { id name } } }")["myself"]["pods"]
    rpods = rest_pods()
    box = int(sh("df -BG --output=avail /workspace | tail -1").stdout.strip().rstrip("G"))
    vfree = int(vps("df -BG --output=avail / | tail -1").stdout.strip().rstrip("G"))
    b = balance(); spent = ledger_spent(); cum = SPENT_BEFORE_LEDGER + spent
    anc = sh(f"cd {REPO_WT} && git fetch -q origin plan/phase3-recipe-stability && git merge-base --is-ancestor {signed} origin/plan/phase3-recipe-stability", check=False).returncode == 0
    clean = sh(f"cd {REPO_WT} && git diff --quiet {signed} -- {REL} tools/evaluator-training/primitives/kind-label-table.json", check=False).returncode == 0
    files_ok = {f: sha(os.path.join(HERE, f)) == s for f, s in pins["files"].items()}
    log(f"PRECHECK: pods(gql)={len(pods)} pods(rest)={rpods} box_free={box}G vps_free={vfree}G balance=${b['clientBalance']:.2f} "
        f"cumulative=${cum:.2f} +cap ${CAP_USD} stop_line=${STOP_LINE} signed_on_remote={anc} code_clean={clean} pins_ok={all(files_ok.values())}")
    if pods or rpods: raise SystemExit("ABORT: a pod is already running")
    if cum + CAP_USD > STOP_LINE or cum + CAP_USD > CEILING: raise SystemExit("ABORT: would pass the $45 stop line")
    if not anc or not clean: raise SystemExit("ABORT: signed commit not on remote or working tree differs")
    if not all(files_ok.values()): raise SystemExit(f"ABORT: pinned file sha mismatch {[f for f, v in files_ok.items() if not v]}")
    if box < 5 or vfree < 10: raise SystemExit("ABORT: low disk")
    if b["clientBalance"] < 10 or b["clientBalance"] - CAP_USD < 10: raise SystemExit("ABORT: low balance")
    if sha(GUIDE) != GUIDE_SHA: raise SystemExit("ABORT: guide sha")
    return b["clientBalance"], cum, pins


def py(*args, **kw):
    return sh([sys.executable, *args], check=False, cwd=HERE, **kw)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--signed", required=True); a = ap.parse_args()
    mf = {m["key"]: m for m in json.load(open(f"{V3}/collect/models.selfhost.json"))["models"]}
    bal0, cum0, pins = precheck(a.signed)
    spec_sha = pins["files"]["headext-slot-spec.json"]
    lic = sh(f"python3 /workspace/v3collect/lic_recheck.py {WRITER} {CHECKER}", check=False)
    log("LICENCE RECHECK\n" + lic.stdout.strip())
    if lic.returncode: raise SystemExit("ABORT: licence recheck mismatch")
    gen = f"{OUT}/gen-{WRITER}.jsonl"; items = f"{OUT}/items-hx.jsonl"; labels = f"{OUT}/labels-{CHECKER}.jsonl"
    if os.path.exists(gen): raise SystemExit("ABORT: output already exists (no silent resume)")
    pub = open(KEY + ".pub").read().strip()
    hf = json.load(open("/home/box/sand-data/box-secrets.json"))["card"].get("HF_TOKEN")
    env = [{"key": "PUBLIC_KEY", "value": pub}] + ([{"key": "HF_TOKEN", "value": hf}] if hf else [])
    inp = {"cloudType": "SECURE", "gpuCount": 1, "volumeInGb": 0, "containerDiskInGb": 300, "minVcpuCount": 8, "minMemoryInGb": 60,
           "gpuTypeId": GPU, "name": NAME, "imageName": "runpod/pytorch:1.0.3-cu1290-torch280-ubuntu2204",
           "ports": "22/tcp", "startSsh": True, "env": env}
    try:
        pod = rp.gql("mutation($i: PodFindAndDeployOnDemandInput) { podFindAndDeployOnDemand(input: $i) { id name costPerHr machine { gpuTypeId } } }", {"i": inp})["podFindAndDeployOnDemand"]
    except Exception as e:
        log("create failed:", repr(e)[:300]); status("headext G1 POD NOT CREATED (no RTX PRO 6000 SECURE); nothing billed; stopped")
        raise SystemExit("ABORT: no GPU")
    pid, rate = pod["id"], float(pod["costPerHr"]); t0 = time.time()
    cap_s = min(CAP_MIN * 60, CAP_USD / rate * 3600); deadline = t0 + cap_s
    log(f"POD CREATED {pid} gpu={pod['machine']['gpuTypeId']} rate=${rate}/h cap={cap_s/60:.1f}min")
    json.dump({"pod": pid, "rate": rate, "t0": t0, "deadline": deadline, "bal0": bal0, "signed": a.signed}, open(f"{ROOT}/logs/{NAME}.state.json", "w"))
    subprocess.Popen(["nohup", "python3", "/workspace/v3collect/watchdog.py", pid, str(deadline)],
                     stdout=open(f"{ROOT}/logs/{NAME}.watchdog.log", "a"), stderr=subprocess.STDOUT, start_new_session=True)
    status(f"headext G1 POD {pid} created ({GPU}, ${rate}/h, SECURE); cap {cap_s/60:.0f} min / ${CAP_USD}; box watchdog started")
    results = {}; T = {"t": None, "args": None, "run": False}
    try:
        ip = port = None
        for _ in range(90):
            s = rp.status(pid)
            for p in ((s or {}).get("runtime") or {}).get("ports") or []:
                if p["privatePort"] == 22 and p["isIpPublic"]: ip, port = p["ip"], p["publicPort"]
            if ip: break
            time.sleep(10)
        if not ip: raise RuntimeError("no ssh port after 15 min")
        S = ssh_base(ip, port)
        for _ in range(30):
            if sh(S + ["true"], check=False).returncode == 0: break
            time.sleep(10)
        remain = int(deadline - time.time() - 60)
        sh(S + [f"cat > /root/wd.sh <<'EOF'\n. /etc/rp_environment\nsleep {remain}\nrunpodctl remove pod $RUNPOD_POD_ID\nEOF"])
        wd = sh(S + ["nohup bash /root/wd.sh >/root/wd.log 2>&1 & sleep 1; pgrep -f 'bash /root/wd.sh' >/dev/null && echo wd_running; "
                     ". /etc/rp_environment; [ -n \"$RUNPOD_POD_ID\" ] && echo has_pod_id; which runpodctl >/dev/null && echo has_runpodctl; "
                     "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader; df -BG --output=avail / | tail -1"]).stdout
        log("IN-POD WATCHDOG + GPU:", wd.replace("\n", " | "))
        if "wd_running" not in wd or "has_runpodctl" not in wd: raise RuntimeError("in-pod watchdog not running")
        hfenv = "export HF_HOME=/root/hf HF_HUB_ENABLE_HF_TRANSFER=1 HF_XET_HIGH_PERFORMANCE=1; export HF_TOKEN=\"$(tr '\\0' '\\n' </proc/1/environ | sed -n 's/^HF_TOKEN=//p')\"; "

        def prefetch(k):
            m = mf[k]
            inc = " ".join(f"--exclude '{p}'" for p in ("original/*", "*.pth", "*.gguf", "consolidated*"))
            c = f"/opt/v/bin/hf download {m['hf_id']} --revision {m['revision']} {inc} >/root/dl-{k}.log 2>&1 && touch /root/dl-{k}.done || touch /root/dl-{k}.fail"
            sh(S + [hfenv + f"setsid nohup sh -c {shlex.quote(c)} >/dev/null 2>&1 &"])
            log(f"PREFETCH started {k}")

        inst = sh(S + ["pip install -q uv >/dev/null 2>&1; uv venv -q /opt/v -p 3.11 && uv pip install -q -p /opt/v 'https://github.com/vllm-project/vllm/releases/download/v0.32.0/vllm-0.32.0+cu129-cp38-abi3-manylinux_2_28_x86_64.whl' hf_transfer --extra-index-url https://download.pytorch.org/whl/cu129 --index-strategy unsafe-best-match >/root/install.log 2>&1; "
                       "uv pip install -q -p /opt/v --reinstall-package torchcodec torchcodec --index-url https://download.pytorch.org/whl/cu129 >>/root/install.log 2>&1; "
                       "/opt/v/bin/python -c 'import vllm,torch;print(vllm.__version__, torch.__version__, torch.cuda.is_available())'"], check=False, timeout=1500)
        log("INSTALL:", inst.stdout.strip())
        if inst.returncode or "True" not in inst.stdout: raise RuntimeError("vLLM install failed")
        host = f"runpod:{pid}/{GPU.replace(' ', '_')}/vllm-{inst.stdout.split()[0]}"
        lport = [18600]

        def serve(k, max_len):
            m = mf[k]
            while True:
                st = sh(S + [f"ls /root/dl-{k}.done /root/dl-{k}.fail 2>/dev/null"], check=False).stdout
                if f"dl-{k}.done" in st or f"dl-{k}.fail" in st: break
                if time.time() > deadline - 10 * 60: break
                time.sleep(15)
            if f"dl-{k}.done" not in st: raise RuntimeError(f"download failed {k}")
            args = list(m["vllm_serve_args"])
            if "--max-model-len" in args: args[args.index("--max-model-len") + 1] = str(max_len)
            else: args += ["--max-model-len", str(max_len)]
            qa = " ".join(shlex.quote(x) for x in args)
            sh(S + [f"export HF_HOME=/root/hf HF_HUB_OFFLINE=1 VLLM_USE_FLASHINFER_SAMPLER=0 PATH=/opt/v/bin:/usr/local/cuda/bin:$PATH CUDA_HOME=/usr/local/cuda; nohup /opt/v/bin/vllm serve {m['hf_id']} --revision {m['revision']} --served-model-name {k} "
                    f"--host 127.0.0.1 --port 8000 --gpu-memory-utilization 0.92 {qa} >/root/serve-{k}.log 2>&1 &"])
            up = False; ts = time.time()
            while time.time() < deadline - 8 * 60:
                h = sh(S + ["curl -sf localhost:8000/health && echo UP; pgrep -f '[v]llm serve' >/dev/null || echo DEAD"], check=False).stdout
                if "UP" in h: up = True; break
                if "DEAD" in h: break
                time.sleep(10)
            if not up:
                open(f"{OUT}/logs/serve-{k}.log.tail", "w").write(sh(S + [f"grep -v -i token= /root/serve-{k}.log | grep -v -i prompt | tail -40"], check=False).stdout)
                raise RuntimeError(f"serve failed {k}")
            log(f"SERVING {k} after {(time.time()-ts)/60:.1f} min load; t+{(time.time()-t0)/60:.1f}")
            T["run"] = False
            if T["t"]: T["t"].kill(); T["t"].wait()
            lport[0] += 1
            T["args"] = S[:-1] + ["-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveCountMax=6", "-N", "-L", f"{lport[0]}:127.0.0.1:8000", S[-1]]
            T["t"] = subprocess.Popen(T["args"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            ok = False
            for _ in range(15):
                time.sleep(3)
                try:
                    hh = urllib.request.urlopen(f"http://127.0.0.1:{lport[0]}/health", timeout=10).status
                    ms = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{lport[0]}/v1/models", timeout=10).read())
                    if hh == 200 and any(x.get("id") == k for x in ms.get("data", [])): ok = True; break
                except Exception: pass
            log(f"TUNNEL PROBE {k}: {'OK' if ok else 'FAILED'} port {lport[0]}")
            if not ok: raise RuntimeError(f"tunnel probe failed {k}")
            T["run"] = True

            def keep():
                while T["run"]:
                    if T["t"].poll() is not None:
                        log(f"TUNNEL DIED during {k}; restarting"); T["t"] = subprocess.Popen(T["args"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    time.sleep(2)
            threading.Thread(target=keep, daemon=True).start()
            return f"http://127.0.0.1:{lport[0]}"

        def stop_serve(k):
            T["run"] = False
            open(f"{OUT}/logs/serve-{k}.log.tail", "w").write(sh(S + [f"grep -v -i token= /root/serve-{k}.log | grep -v -i prompt | tail -60"], check=False).stdout)
            m = mf[k]; d = "/root/hf/hub/models--" + m["hf_id"].replace("/", "--")
            sh(S + [f"pkill -f '[v]llm serve'; sleep 8; pkill -9 -f '[v]llm serve'; rm -rf {d} /root/.cache/vllm; true"], check=False)
            log(f"CACHE CLEARED after {k}: {sh(S + ['df -BG --output=avail / | tail -1']).stdout.strip()} free")

        # 1. generation (Qwen3-30B-A3B-Instruct-2507, pinned slot spec + system prompt; thinking off)
        prefetch(WRITER)
        base = serve(WRITER, 4096)
        prefetch(CHECKER)
        wall = int(min(25 * 60, deadline - time.time() - 35 * 60))
        if wall < 300: raise RuntimeError("not enough time left for generation + checker")
        g = py("headext_slots.py", "generate", "--base-url", base, "--served", WRITER, "--out", gen, "--host", host,
               "--expect-spec-sha", spec_sha, "--concurrency", "64", "--max-wall-seconds", str(wall))
        gl = (g.stdout.strip().splitlines() or ["{}"])[-1]
        log(f"GENERATE rc={g.returncode} {gl[:1500]} {g.stderr.strip()[-300:] if g.returncode not in (0, 3) else ''}")
        try: results["generate"] = json.loads(gl)
        except Exception: results["generate"] = None
        stop_serve(WRITER)
        if not os.path.exists(gen): raise RuntimeError("no generator output")
        it = py("headext_slots.py", "items", "--gen", gen, "--out", items)
        log("ITEMS " + it.stdout.strip()[-400:]); results["items"] = json.loads(it.stdout.strip().splitlines()[-1])
        # 2. checker labels (Seed-OSS, delete-only)
        lb = serve(CHECKER, 8192)
        wall = int(min(30 * 60, deadline - time.time() - 9 * 60))
        if wall < 120: raise RuntimeError(f"no time left to label with {CHECKER}")
        cl = sh([sys.executable, "-m", "airp_v3.label_local", "--base-url", lb, "--labelers", "labelcmp/labelers.labelcmp.json",
                 "--labeler-key", CHECKER, "--models", "collect/models.selfhost.json", "--policy-file", "policy/POLICY_VERIFIED.json",
                 "--guide", GUIDE, "--items", items, "--out", labels, "--host", host,
                 "--concurrency", "64", "--max-wall-seconds", str(wall)], check=False, cwd=V3)
        log(f"LABEL DONE {CHECKER} rc={cl.returncode} {cl.stdout.strip()[-400:]} {cl.stderr.strip()[-300:]}")
        results[f"label-{CHECKER}"] = {0: "complete", 3: "stopped_early", 2: "blocked"}.get(cl.returncode, f"rc{cl.returncode}")
        stop_serve(CHECKER)
        T["run"] = False
        if T["t"]: T["t"].kill()
    except Exception as e:
        log("FAILURE:", repr(e)[:1500])
        status(f"FAILURE on headext G1 pod {pid}: {repr(e)[:200]} - archiving and terminating now")
        results["failure"] = repr(e)[:300]
    finally:
        T["run"] = False
        if T["t"]: T["t"].kill()
        # 3. checker-delete (unviewed; CSE / eck / invalid / missing label) BEFORE any archive, then the interim report
        if os.path.exists(gen):
            try:
                if not os.path.exists(items):
                    py("headext_slots.py", "items", "--gen", gen, "--out", items)
                cd = py("headext_filter.py", "checker-delete", "--labels", labels, "--labeler", CHECKER, "--family", CHECKER_FAMILY,
                        "--items", items, "--log", f"{OUT}/checker-delete-{CHECKER}.json", "--text-file", gen, "--text-file", items)
                log(f"CHECKER-DELETE rc={cd.returncode} {cd.stdout.strip()[-3000:]} {cd.stderr.strip()[-300:]}")
                results["checker_delete_rc"] = cd.returncode
                if cd.returncode: raise RuntimeError("checker-delete failed")
                im = py("headext_filter.py", "interim", "--gen", gen, "--expect-spec-sha", spec_sha, "--out", f"{OUT}/interim-g1.json")
                log(f"INTERIM rc={im.returncode} {im.stdout.strip()[-600:]} {im.stderr.strip()[-300:]}")
                results["interim_rc"] = im.returncode
            except Exception as e:
                log("CHECKER-DELETE FAILURE: generated rows NOT archived:", repr(e)[:300])
                for p in (gen, items):
                    if os.path.exists(p): os.replace(p, p + ".quarantine.tmp")  # excluded from the archive manifest
                results["quarantined"] = True
        try: results["archive_pre_terminate"] = arch()
        except Exception as e: log("ARCHIVE FAILURE (terminating anyway):", repr(e)[:600])
        for i in range(5):
            try: rp.terminate(pid); break
            except Exception as e: log("terminate retry", repr(e)[:200]); time.sleep(10)
        t1 = time.time(); time.sleep(25)
        allp = gq("query { myself { pods { id name } } }")["myself"]["pods"]
        try: rpods = rest_pods()
        except Exception as e: rpods = f"rest error {repr(e)[:100]}"
        bal1 = balance()["clientBalance"]
        cost = max(rate * (t1 - t0) / 3600, bal0 - bal1)
        log(f"TERMINATED {pid} pod_list_after(gql)={allp} rest={rpods} minutes={(t1-t0)/60:.1f} balance {bal0:.3f}->{bal1:.3f} cost=${cost:.3f}")
        gen_st = results.get("generate") or {}
        row = "\t".join(str(x) for x in [NAME, pid, GPU, rate, time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(t0)),
            time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(t1)), f"{bal0:.3f}", f"{bal1:.3f}", f"{cost:.3f}",
            f"headext G1 qwen gen + seed-oss checker; rows:{gen_st.get('n_rows_written')} checker_delete_rc:{results.get('checker_delete_rc')} failure:{bool(results.get('failure'))}"])
        vps(f"echo {shlex.quote(row)} >> {LEDGER}")
        tot = ledger_spent()
        res = {"pod": pid, "results": results, "cost": cost, "bal0": bal0, "bal1": bal1, "pod_list_after": allp, "rest_pods_after": rpods,
               "cumulative": SPENT_BEFORE_LEDGER + tot, "minutes": (t1 - t0) / 60, "signed": a.signed, "t0": t0, "t1": t1}
        json.dump(res, open(f"{ROOT}/logs/{NAME}.result.json", "w"), indent=1, default=str)
        status(f"headext G1 TERMINATED {pid} after {(t1-t0)/60:.1f} min; pods={len(allp)}; cost ${cost:.2f}; bal ${bal1:.2f}; "
               f"cum ${SPENT_BEFORE_LEDGER + tot:.2f}; checker_delete_rc={results.get('checker_delete_rc')}")
        try: arch()
        except Exception as e: log("final archive failed:", repr(e)[:300])


if __name__ == "__main__":
    os.makedirs(f"{ROOT}/logs", exist_ok=True); os.makedirs(f"{OUT}/logs", exist_ok=True)
    LOG = open(f"{ROOT}/logs/{NAME}.log", "a")
    main()
