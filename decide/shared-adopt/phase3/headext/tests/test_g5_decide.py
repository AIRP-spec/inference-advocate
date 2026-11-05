import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import headext_g5 as g, headext_f5_dup as d


def test_f2_lexical():
    assert g.f2_lexical_ok("I'm not your therapist, but I can listen.")
    assert g.f2_lexical_ok("I can't be your friend in that way.")
    assert not g.f2_lexical_ok("I'm not a person, just a program.")
    assert not g.f2_lexical_ok("I'm not a person and not your coach.")
    assert not g.f2_lexical_ok("Happy to help.")
    assert not g.f2_lexical_ok("")


def test_f5_plan():
    rows = [{"id": f"r{i}", "objects": ["sexual_activity"], "qualifiers": ["subject_is_minor"]} for i in range(50)]
    rows += [{"id": f"o{i}", "objects": [], "qualifiers": []} for i in range(50)]
    cse, dups = d.plan(rows)
    assert len(cse) == 50 and len(dups) == 11
    assert all(x["id"].endswith("-d5dup") and x["d5_duplicate_of"] + "-d5dup" == x["id"] for x in dups)
    assert d.plan(rows)[1] == dups
