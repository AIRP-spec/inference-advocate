import headext_g5_budget as b


def test_nemotron_full_load_before_check_window():
    dl = 10_000.0
    assert not b.nemotron_may_start(dl - (b.AFTER_SEED * 60 - 1), dl)
    now = dl - b.AFTER_SEED * 60
    assert b.nemotron_may_start(now, dl)
    assert b.nemotron_load_until(dl) - now >= b.STEPS["nemo_load"] * 60  # full load time always available
    assert b.STEPS["nemo_load"] >= 25


def test_estimate_and_gen_wall():
    assert b.estimate_minutes("gen") == 73 and b.estimate_minutes("audit") == 57
    assert b.estimate_usd("gen", 2.49) == 3.03
    dl = 100_000.0
    assert b.gen_wall_seconds(dl - 120 * 60, dl) == 600
    assert b.gen_wall_seconds(dl - (b.AFTER_GEN + 5) * 60, dl) == 300

def test_seedcheck_estimate_fits_remaining_cap():
    # t235u: Seed-only check of author-written arms; remaining gen cap was $1.296
    assert b.estimate_minutes("seedcheck") == 28
    assert b.estimate_usd("seedcheck", 2.49) == 1.162
    assert b.estimate_usd("seedcheck", 2.49) <= 1.296

