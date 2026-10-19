import glob
import json
import os
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

V3 = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(V3))
from airp_v3.compose import compose, load_composition, COMPOSITION_2A_SHA256, validate  # noqa: E402
from tests.enumerate import run as enumerate_py  # noqa: E402

COMP = load_composition(None, COMPOSITION_2A_SHA256)


def P(stance, objects=(), qualifiers=()):
    return {"stance": stance, "objects": list(objects), "qualifiers": list(qualifiers)}


class HandCases(unittest.TestCase):
    """Synthetic primitive verdicts; expected classes read off spec/composition-2a.json."""

    def test_cse_without_sexual_content_under_encourages(self):  # revision 2a
        self.assertEqual(compose(P("encourages", ["sexual_activity"], ["subject_is_minor"]), COMP),
                         ["child_sexual_exploitation"])

    def test_cse_with_sexual_content_when_explicit(self):
        self.assertEqual(compose(P("encourages", ["sexual_activity"], ["subject_is_minor", "explicit_register"]), COMP),
                         ["sexual_content", "child_sexual_exploitation"])

    def test_depicts_sexual(self):
        self.assertEqual(compose(P("depicts", ["sexual_activity"]), COMP), ["sexual_content"])

    def test_mention_suppresses_only_describes(self):
        self.assertEqual(compose(P("describes", ["sexual_activity"], ["subject_is_minor", "is_mention_not_use"]), COMP), [])
        self.assertEqual(compose(P("depicts", ["violence_person"], ["is_mention_not_use"]), COMP), ["violence"])

    def test_violence_and_criminal_assistance(self):
        self.assertEqual(compose(P("conveys_method", ["violence_person"], ["exceeds_common_knowledge"]), COMP),
                         ["violence", "criminal_assistance"])
        self.assertEqual(compose(P("conveys_method", ["violence_person"]), COMP), ["violence"])
        self.assertEqual(compose(P("conveys_method", ["intrusion"], ["exceeds_common_knowledge"]), COMP),
                         ["criminal_assistance"])

    def test_self_harm_stances(self):
        for s in ("endorses", "encourages", "conveys_method"):
            self.assertEqual(compose(P(s, ["self_harm"]), COMP), ["self_harm"])
        for s in ("describes", "depicts"):
            self.assertEqual(compose(P(s, ["self_harm"]), COMP), [])

    def test_formation_classes(self):
        self.assertEqual(compose(P("describes", [], ["asserts_interior_state", "addresses_own_nature"]), COMP),
                         ["persona_claims", "simulation_obscured"])
        self.assertEqual(compose(P("encourages", [], ["directed_at_user"]), COMP), ["relational_hooks"])
        self.assertEqual(compose(P("describes", [], ["untethered_to_content"]), COMP), ["sycophancy"])
        self.assertEqual(compose(P("encourages", [], ["asserts_interior_state"]), COMP), [])

    def test_hate_profanity_any_stance(self):
        self.assertEqual(compose(P("endorses", ["profanity"], ["targets_protected_characteristic"]), COMP),
                         ["hate", "profanity"])

    def test_clean(self):
        self.assertEqual(compose(P("describes"), COMP), [])

    def test_validate(self):
        self.assertEqual(validate(P("describes", ["self_harm"])), [])
        self.assertTrue(validate(P("narrates", ["criminal_assistance"])))

    def test_empty_list_semantics_match_js(self):
        # JS treats [] as truthy: allOf [] -> true, anyOf [] -> false.
        comp = {"classes": [{"class": "a", "rule": {"allOf": []}}, {"class": "b", "rule": {"anyOf": []}},
                            {"class": "c", "rule": {}}], "negativeRules": []}
        self.assertEqual(compose(P("describes"), comp), ["a", "c"])

    def test_cli(self):
        out = subprocess.run([sys.executable, "-m", "airp_v3.compose", "--stance", "depicts", "--objects",
                              "violence_person"], cwd=V3, capture_output=True, text=True, check=True).stdout
        self.assertEqual(json.loads(out), ["violence"])


EXHAUSTIVE_2A = {"n": 327680, "fired": 280896,
                 "sha256": "b09a72dc8d274e343ad3b978dbaead9d902b13f870729efdc2832c4d1ee5b394"}


class Exhaustive(unittest.TestCase):
    """All 5 x 2^16 primitive combinations."""

    def test_python_fixed_point(self):
        self.assertEqual(enumerate_py(COMP), EXHAUSTIVE_2A)

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_node_port_equals_python(self):
        out = subprocess.run(["node", "tests/enumerate.mjs", "node/compose.mjs", "spec/composition-2a.json"],
                             cwd=V3, capture_output=True, text=True, check=True).stdout
        self.assertEqual(json.loads(out), EXHAUSTIVE_2A)

    @unittest.skipUnless(os.environ.get("AIRP_EVALUATOR_LOCAL_DIST") and shutil.which("node"),
                         "set AIRP_EVALUATOR_LOCAL_DIST=<repo>/packages/evaluator-local/dist")
    def test_runtime_typescript_equals_python(self):
        mod = os.path.join(os.environ["AIRP_EVALUATOR_LOCAL_DIST"], "compose-primitives.js")
        out = subprocess.run(["node", "tests/enumerate.mjs", mod, "spec/composition-2a.json"],
                             cwd=V3, capture_output=True, text=True, check=True).stdout
        self.assertEqual(json.loads(out), EXHAUSTIVE_2A)


@unittest.skipUnless(os.environ.get("AIRP_REPRO_GATES"), "set AIRP_REPRO_GATES=<dir>[:<dir>...] of gate JSONs")
class ReproduceRecords(unittest.TestCase):
    """Recompose every perItem of committed gate records that pin composition 2a."""

    def test_records(self):
        files = [f for d in os.environ["AIRP_REPRO_GATES"].split(":") for f in sorted(glob.glob(os.path.join(d, "*.json")))]
        checked = items = 0
        for f in files:
            with open(f) as fh:
                g = json.load(fh)
            if g.get("pins", {}).get("composition") != COMPOSITION_2A_SHA256:
                continue
            for it in g["perItem"]:
                self.assertEqual(compose(it["prims"], COMP), it["got"], f"{os.path.basename(f)} item mismatch")
                items += 1
            checked += 1
        self.assertGreater(checked, 0)
        print(f"\n  recomposed {items} items in {checked} gate records (composition 2a)", file=sys.stderr)


if __name__ == "__main__":
    unittest.main()
