/**
 * ADR 2026-11-01 (sh-02 primitive correction): the offer/pointer kind is encourages + self_harm with no qualifiers,
 * (class derivation is checked in phase3/p33/resplit_v9.py). Pure-function test (no corpus, no output files).
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mapKindToPrimitives } from "./relabel-from-slots.mjs";

test("self-harm-named-method-offer -> encourages + self_harm, no exceeds_common_knowledge", () => {
  const p = mapKindToPrimitives("self-harm-named-method-offer", ["self_harm"], "", "text", "positive-composed", { id: "t" });
  assert.equal(p.stance, "encourages");
  assert.deepEqual(p.objects, ["self_harm"]);
  assert.deepEqual(p.qualifiers, []);
  assert.equal(p.needsTiebreaker, false);
});

test("announce and offer kinds share the encourages label", () => {
  const a = mapKindToPrimitives("self_harm-clinical-announce", ["self_harm"], "", "announce", "positive-composed", { id: "t" });
  const o = mapKindToPrimitives("self-harm-named-method-offer", ["self_harm"], "", "text", "positive-composed", { id: "t" });
  assert.equal(a.stance, o.stance);
  assert.deepEqual(a.objects, o.objects);
});
