"""Time budget for the t237u G6 generation pod (F6 op-own-vs-reported pairs).
Nemotron still gets its full 25-min load before its checking window. host_start is 8 min because
the driver abandons a host that has not started by then (G5 was tightened the same way; the G5
STEPS table still listed 16). Other allowances match the G5 measured worst cases."""
STEPS = {"host_start": 8, "install": 2, "qwen_load": 6, "generate": 10, "seed_load": 6, "seed_check": 2,
         "nemo_load": 25, "nemo_check": 4, "archive": 2}
CHECK_WINDOW = 8
AFTER_SEED = STEPS["nemo_load"] + CHECK_WINDOW
AFTER_GEN = STEPS["seed_load"] + STEPS["seed_check"] + AFTER_SEED + STEPS["archive"]


def estimate_minutes(stage: str = "gen") -> int:
    if stage != "gen":
        raise ValueError(f"g6 budget is gen-only, not {stage}")
    return sum(STEPS.values())


def estimate_usd(stage: str, rate: float) -> float:
    return round(estimate_minutes(stage) / 60 * rate, 3)


def nemotron_may_start(now: float, deadline: float) -> bool:
    return deadline - now >= AFTER_SEED * 60


def nemotron_load_until(deadline: float) -> float:
    return deadline - CHECK_WINDOW * 60


def gen_wall_seconds(now: float, deadline: float) -> int:
    return int(min(STEPS["generate"] * 60, deadline - now - AFTER_GEN * 60))
