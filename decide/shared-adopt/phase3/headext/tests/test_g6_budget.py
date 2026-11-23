import headext_g6_budget as B

def test_g6_gen_estimate_under_three_dollar_cap():
    assert B.estimate_minutes("gen") == 65
    assert B.estimate_usd("gen", 2.49) == 2.698
    assert B.estimate_usd("gen", 2.49) <= 3.0
    # Nemotron still gets a full 25-min load plus the 8-min check window
    assert B.AFTER_SEED == 33
    assert B.STEPS["nemo_load"] == 25
