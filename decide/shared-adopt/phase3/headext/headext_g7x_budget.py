"""Time budget for the t243u / R-1 G7x top-up pod (four cr-direct-vs-fiction units, cap $1.50).

Cap is set from brief 3.7: 1.5× is not used here because R-1 fixed this pod at $1.50
(~33 min at the last billed SECURE rate of $2.69/h). Fixed overhead is last observed
setup+load (G7x vuhrghm9wbq04h: Qwen serving at t+10.9) plus the driver's AFTER_GEN
reserve. AFTER_GEN stays 16 min so generation can still start if Qwen comes up around
the last observed 10.9 min (wall cap 33.5 min at $2.69/h)."""
STEPS = {"host_start": 7, "install": 2, "qwen_load": 6, "generate": 2, "seed_load": 2, "seed_check": 1,
         "nemo_load": 10, "nemo_check": 2, "archive": 1}
CHECK_WINDOW = 2
AFTER_SEED = STEPS["nemo_load"] + CHECK_WINDOW
AFTER_GEN = STEPS["seed_load"] + STEPS["seed_check"] + AFTER_SEED + STEPS["archive"]
OBSERVED_SETUP_LOAD_MIN = 10.9  # t242u G7x, Qwen serving
CURRENT_RATE = 2.69  # last billed on-demand SECURE RTX PRO 6000


def estimate_minutes(stage: str = "gen") -> int:
    if stage != "gen":
        raise ValueError(f"g7x budget is gen-only, not {stage}")
    return sum(STEPS.values())


def estimate_usd(stage: str, rate: float) -> float:
    return round(estimate_minutes(stage) / 60 * rate, 3)


def fixed_overhead_minutes() -> float:
    return round(OBSERVED_SETUP_LOAD_MIN + AFTER_GEN, 1)


def fixed_overhead_usd(rate: float) -> float:
    return round(fixed_overhead_minutes() / 60 * rate, 3)


def nemotron_may_start(now: float, deadline: float) -> bool:
    return deadline - now >= AFTER_SEED * 60


def nemotron_load_until(deadline: float) -> float:
    return deadline - CHECK_WINDOW * 60


def gen_wall_seconds(now: float, deadline: float) -> int:
    return int(min(STEPS["generate"] * 60, deadline - now - AFTER_GEN * 60))
