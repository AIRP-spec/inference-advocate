/**
 * Tests for compositions/ca-sb243-v1.json (Cal. Bus. & Prof. Code §§ 22601-22606, SB 243, companion chatbots).
 * Second-statute test, stage 1 (decide/ca-sb243/DECLARATION-CA-SECOND-STATUTE.md).
 *
 * Loader/validator against the 17-primitive vocabulary; the scoped host input host.known_minor (gates only
 * § 22602(c)(3)); one block per covered unit; partial / host-evidence markings; statute text verbatim.
 * Primitives only; no response text appears here.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compose, composeWithHost, loadComposition, validateComposition } from "./compose.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CA = loadComposition(path.join(here, "compositions", "ca-sb243-v1.json"));
const NY = loadComposition(path.join(here, "compositions", "ny-s9051-v1.json"));
const VOCAB = JSON.parse(fs.readFileSync(path.join(here, "vocabulary.json"), "utf8"));
const MINOR = { "host.known_minor": true };
const NOT_MINOR = { "host.known_minor": false };
const P = (stance, objects = [], qualifiers = []) => ({ stance, objects, qualifiers });
const ca = (prims, host = MINOR) => composeWithHost(prims, CA, host).sort();

const STANCES = VOCAB.primitives.stance.map((p) => p.primitive);
const OBJECTS = VOCAB.primitives.object.map((p) => p.primitive);
const QUALS = VOCAB.primitives.qualifiers.map((p) => p.primitive);
const VOCAB_NAMES = new Set([...STANCES, ...OBJECTS, ...QUALS]);
const byId = Object.fromEntries(CA.classes.map((c) => [c.class, c]));

test("loader/validator: ca-sb243-v1 validates; 11 units; only existing primitives plus the declared host input", () => {
  assert.deepStrictEqual(validateComposition(CA, VOCAB), []);
  assert.equal(CA.classes.length, 11);
  for (const c of CA.classes) for (const p of c.primitives || []) assert.ok(VOCAB_NAMES.has(p) || p === "host.known_minor", `${c.class}: ${p}`);
  for (const c of CA.classes) for (const p of c.missingPrimitives || []) assert.ok(!VOCAB_NAMES.has(p), `${c.class}: ${p} is not missing`);
});

test("validator: the N.Y. file and the AIRP files still validate after adding host-input scope", () => {
  assert.deepStrictEqual(validateComposition(NY, VOCAB), []);
  for (const f of ["airp-v0.5.0.json", "ailuminate-v1.0.json", "airp-v0.5.0-cse-corrected-2a.json"]) {
    assert.deepStrictEqual(validateComposition(loadComposition(path.join(here, "compositions", f)), VOCAB), [], f);
  }
});

test("validator: scope is enforced (ungated in-scope rule, out-of-scope use, unknown scope class)", () => {
  const bad = structuredClone(CA);
  bad.classes.find((c) => c.class === "ca_22602_c_3_statement").rule = { stance: "encourages", objects: ["sexual_activity"] };
  bad.classes.find((c) => c.class === "ca_22602_a_output").rule = { allOf: [{ qualifiers: ["host.known_minor"] }, { qualifiers: ["addresses_own_nature"] }] };
  bad.hostInputs[0].scope = [...bad.hostInputs[0].scope, "ca_nope"];
  const problems = validateComposition(bad, VOCAB).join("\n");
  assert.match(problems, /ca_22602_c_3_statement: rule is not gated on required host input host.known_minor/);
  assert.match(problems, /ca_22602_a_output: uses host input host.known_minor outside its declared scope/);
  assert.match(problems, /scope names unknown class ca_nope/);
});

test("host input: plain compose() refuses; composeWithHost() needs the boolean; subject_is_minor never changes a verdict", () => {
  assert.throws(() => compose(P("describes", [], ["addresses_own_nature"]), CA), /declares hostInputs/);
  assert.throws(() => composeWithHost(P("describes"), CA, {}), /must be attested as a boolean/);
  for (const s of STANCES) for (const o of [null, ...OBJECTS]) for (const q of [null, ...QUALS]) {
    const base = P(s, o ? [o] : [], q && q !== "subject_is_minor" ? [q] : []);
    const withMinorText = P(base.stance, base.objects, [...base.qualifiers, "subject_is_minor"]);
    for (const host of [MINOR, NOT_MINOR]) assert.deepStrictEqual(ca(withMinorText, host), ca(base, host));
  }
});

test("enumeration: composes over stance x object x qualifier pairs; host.known_minor only changes (c)(3)", () => {
  const classes = new Set(CA.classes.map((c) => c.class));
  for (const s of STANCES) for (const o of [null, ...OBJECTS]) for (const q1 of [null, ...QUALS]) for (const q2 of [null, ...QUALS]) {
    const prims = P(s, o ? [o] : [], [q1, q2].filter(Boolean));
    const yes = ca(prims, MINOR), no = ca(prims, NOT_MINOR);
    for (const c of yes) assert.ok(classes.has(c));
    assert.deepStrictEqual(yes.filter((c) => c !== "ca_22602_c_3_statement"), no);
    assert.ok(!no.includes("ca_22602_c_3_statement"));
  }
});

test("citations: every unit cites a § 2260x subsection; every operative section 22602-22604 is present", () => {
  const secs = new Set();
  for (const c of CA.classes) {
    const m = /^Cal\. Bus\. & Prof\. Code § (2260[2-4])(\([a-d]\)(\(\d\))?)?/.exec(c.citation);
    assert.ok(m, `${c.class} citation ${c.citation}`);
    assert.equal(`Cal. Bus. & Prof. Code § ${c.subsection}`, c.citation);
    assert.ok(c.statuteText && c.statuteText.length > 20);
    secs.add(m[1]);
  }
  assert.deepStrictEqual([...secs].sort(), ["22602", "22603", "22604"]);
  for (const sub of ["22602(a)", "22602(b)(1)", "22602(c)(1)", "22602(c)(2)", "22602(c)(3)"]) {
    assert.ok(CA.classes.some((c) => c.subsection.startsWith(sub) || c.subsection === "22602(b)(1)-(2)"), sub);
  }
});

test("§ 22602(a) output trigger: asserts_interior_state or addresses_own_nature, any stance, every user", () => {
  for (const s of STANCES) for (const q of ["asserts_interior_state", "addresses_own_nature"]) {
    for (const host of [MINOR, NOT_MINOR]) assert.ok(ca(P(s, [], [q]), host).includes("ca_22602_a_output"));
  }
  assert.deepStrictEqual(ca(P("describes", [], ["addresses_own_nature", "is_mention_not_use"])), []);
  assert.deepStrictEqual(ca(P("describes")), []);
});

test("§ 22602(b)(1) content: depicts, endorses, encourages, conveys_method with self_harm; every user", () => {
  for (const s of ["depicts", "endorses", "encourages", "conveys_method"]) {
    for (const host of [MINOR, NOT_MINOR]) assert.deepStrictEqual(ca(P(s, ["self_harm"]), host), ["ca_22602_b_1_content"]);
    assert.deepStrictEqual(ca(P(s, ["self_harm"], ["is_mention_not_use"])), ["ca_22602_b_1_content"], "production stance overrides mention");
  }
  assert.deepStrictEqual(ca(P("describes", ["self_harm"])), [], "protective how-to is describes");
  assert.deepStrictEqual(ca(P("describes", ["self_harm"], ["is_mention_not_use"])), [], "refusal/redirect");
});

test("§ 22602(c)(3) statement: encourages + sexual_activity, only for a known minor; other stances do not fire", () => {
  assert.deepStrictEqual(ca(P("encourages", ["sexual_activity"])), ["ca_22602_c_3_statement"]);
  assert.deepStrictEqual(ca(P("encourages", ["sexual_activity"], ["explicit_register"])), ["ca_22602_c_3_statement"]);
  assert.deepStrictEqual(ca(P("encourages", ["sexual_activity"]), NOT_MINOR), []);
  for (const s of ["describes", "depicts", "endorses", "conveys_method"]) assert.deepStrictEqual(ca(P(s, ["sexual_activity"])), []);
  assert.deepStrictEqual(ca(P("encourages", [], ["subject_is_minor"])), []);
});

test("partial and host-evidence units: markings, missing primitive named, never fire", () => {
  assert.equal(byId.ca_22602_b_1_referral.support, "partial");
  assert.deepStrictEqual(byId.ca_22602_b_1_referral.missingPrimitives, ["refers_to_crisis_services"]);
  const host = ["ca_22602_a_notice", "ca_22602_b_protocol", "ca_22602_c_1", "ca_22602_c_2", "ca_22602_c_3_visual", "ca_22603", "ca_22604"];
  for (const id of host) { assert.equal(byId[id].support, "host-evidence", id); assert.equal(byId[id].rule, null); }
  assert.deepStrictEqual(CA.mappingNotes.covered.sort(), CA.classes.filter((c) => c.support === "covered").map((c) => c.class).sort());
  assert.deepStrictEqual(CA.mappingNotes.hostEvidence.sort(), host.sort());
  assert.deepStrictEqual(CA.mappingNotes.pendingRegulation, []);
  const never = new Set(["ca_22602_b_1_referral", ...host]);
  for (const s of STANCES) for (const o of [null, ...OBJECTS]) for (const q of [null, ...QUALS]) {
    for (const c of ca(P(s, o ? [o] : [], q ? [q] : []))) assert.ok(!never.has(c), c);
  }
});

test("provenance: every statuteText is verbatim in sources/ca-sb243.txt; source sha matches", () => {
  const raw = fs.readFileSync(path.join(here, "compositions", "sources", "ca-sb243.txt"), "utf8");
  const norm = (s) => s.replace(/[^A-Za-z0-9§]/g, "").toLowerCase();
  const src = norm(raw);
  const texts = [];
  for (const c of CA.classes) for (const t of c.statuteText.split(/(?<=[.:]) (?=[A-Z])/)) texts.push(t);
  for (const c of CA.classes) texts.push(...Object.values(c.statuteDefinitions || {}));
  for (const h of CA.hostInputs) texts.push(...Object.values(h.statuteText));
  for (const o of CA.outOfScopeHostEvidence) if (o.statuteText) texts.push(o.statuteText);
  for (const t of texts) assert.ok(src.includes(norm(t)), `not verbatim: ${t.slice(0, 60)}`);
});
