import headext_g7x_budget as B

def test_g7x_gen_estimate_under_one_fifty_cap():
    assert B.estimate_minutes("gen") == 33
    assert B.AFTER_GEN == 16
    assert B.fixed_overhead_minutes() == 26.9
    assert B.fixed_overhead_usd(2.69) == 1.206
    assert B.estimate_usd("gen", 2.49) == 1.370
    assert B.estimate_usd("gen", 2.69) == 1.480
    assert B.estimate_usd("gen", 2.69) <= 1.50
    assert B.fixed_overhead_usd(2.69) <= 1.50
    assert B.CHECK_WINDOW == 2
    assert B.AFTER_SEED == 12
    assert B.STEPS["nemo_load"] == 10
