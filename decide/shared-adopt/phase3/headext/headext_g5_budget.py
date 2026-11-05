"""Time budget for G5 pods (t234u item 3): Nemotron gets its full load time before its checking window starts.
Minutes: worst observed in G4 / G5 attempts 1-2, rounded up (host start 16 [att.1], install 1 -> 2, Qwen load 6, generation
wall 10, Seed load 5.6 -> 6, Seed label+check 0.2 -> 2, Nemotron load 15.3 [G4] -> 25 allowed, Nemotron label+check 0.8 [G4,
230 items] -> 4, archive + terminate 1.5 -> 2). Nemotron's check window is 8 min (2x its allowance) for the gate."""
STEPS = {"host_start": 16, "install": 2, "qwen_load": 6, "generate": 10, "seed_load": 6, "seed_check": 2,
         "nemo_load": 25, "nemo_check": 4, "archive": 2}
CHECK_WINDOW = 8
AFTER_SEED = STEPS["nemo_load"] + CHECK_WINDOW          # time Nemotron must still have when its serve starts
AFTER_GEN = STEPS["seed_load"] + STEPS["seed_check"] + AFTER_SEED + STEPS["archive"]


def estimate_minutes(stage: str) -> int:
    skip = set() if stage == "gen" else {"qwen_load", "generate"}
    return sum(v for k, v in STEPS.items() if k not in skip)


def estimate_usd(stage: str, rate: float) -> float:
    return round(estimate_minutes(stage) / 60 * rate, 3)


def nemotron_may_start(now: float, deadline: float) -> bool:
    return deadline - now >= AFTER_SEED * 60


def nemotron_load_until(deadline: float) -> float:
    """The load wait ends only when the checking window would start; gated by nemotron_may_start, so it is >= nemo_load."""
    return deadline - CHECK_WINDOW * 60


def gen_wall_seconds(now: float, deadline: float) -> int:
    return int(min(STEPS["generate"] * 60, deadline - now - AFTER_GEN * 60))
