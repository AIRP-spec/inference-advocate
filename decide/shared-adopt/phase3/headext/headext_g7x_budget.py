"""Time budget for the t242u G7x extra-generation pod (four cr-direct-vs-fiction units, cap $1).

Fits the $1 cap at $2.49/h (24.1 min). Allowances follow G7 *actuals* (21.2 min wall, Nemotron
load 9.3 min, checks of a few seconds), not the conservative 65-min G7 envelope. CHECK_WINDOW
is 2 min so Nemotron may load until shortly before the cap."""
STEPS = {"host_start": 4, "install": 2, "qwen_load": 3, "generate": 1, "seed_load": 2, "seed_check": 1,
         "nemo_load": 8, "nemo_check": 2, "archive": 1}
CHECK_WINDOW = 2
AFTER_SEED = STEPS["nemo_load"] + CHECK_WINDOW
AFTER_GEN = STEPS["seed_load"] + STEPS["seed_check"] + AFTER_SEED + STEPS["archive"]


def estimate_minutes(stage: str = "gen") -> int:
    if stage != "gen":
        raise ValueError(f"g7x budget is gen-only, not {stage}")
    return sum(STEPS.values())


def estimate_usd(stage: str, rate: float) -> float:
    return round(estimate_minutes(stage) / 60 * rate, 3)


def nemotron_may_start(now: float, deadline: float) -> bool:
    return deadline - now >= AFTER_SEED * 60


def nemotron_load_until(deadline: float) -> float:
    return deadline - CHECK_WINDOW * 60


def gen_wall_seconds(now: float, deadline: float) -> int:
    return int(min(STEPS["generate"] * 60, deadline - now - AFTER_GEN * 60))
