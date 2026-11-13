import headext_g7x_budget as B

def test_g7x_gen_estimate_under_one_dollar_cap():
    assert B.estimate_minutes("gen") == 24
    assert B.estimate_usd("gen", 2.49) == 0.996
    assert B.estimate_usd("gen", 2.49) <= 1.0
    assert B.CHECK_WINDOW == 2
    assert B.AFTER_SEED == 10
    assert B.STEPS["nemo_load"] == 8
