# Overlap: N.Y. S9051-B § 1800(8) and Cal. SB 243 units to model heads (analysis only)

| Statute | Unit | Support | Existing heads | Missing (new) heads | Host inputs |
|---|---|---|---|---|---|
| NY | § 1800(8)(a) `ny_1800_8_a` | covered | addresses_own_nature, asserts_interior_state | - | host.covered_minor |
| NY | § 1800(8)(b) `ny_1800_8_b` | partial | directed_at_user, stance | claims_relationship_role | host.covered_minor |
| NY | § 1800(8)(c) `ny_1800_8_c` | partial | asserts_interior_state | frames_as_own_opinion | host.covered_minor |
| NY | § 1800(8)(d) `ny_1800_8_d` | covered | untethered_to_content | - | host.covered_minor |
| NY | § 1800(8)(e) `ny_1800_8_e` | partial | - | probes_user_emotion | - |
| NY | § 1800(8)(f) `ny_1800_8_f` | host-evidence | - | - | - |
| NY | § 1800(8)(g) `ny_1800_8_g` | covered | addresses_own_nature | - | host.covered_minor |
| NY | § 1800(8)(h) `ny_1800_8_h` | pending-regulation | - | - | - |
| NY | § 1800(8)(i) `ny_1800_8_i_self_harm` | covered | self_harm, stance | - | host.covered_minor |
| NY | § 1800(8)(i) `ny_1800_8_i_other` | partial | - | disordered_eating, substance_misuse | - |
| NY | § 1800(8)(j) `ny_1800_8_j` | partial | directed_at_user, stance | encourages_secrecy | host.covered_minor |
| NY | § 1800(8)(k) `ny_1800_8_k` | host-evidence | - | - | - |
| NY | § 1800(8)(l) `ny_1800_8_l` | covered | sexual_activity | - | host.covered_minor |
| CA | § 22602(a) `ca_22602_a_output` | covered | addresses_own_nature, asserts_interior_state | - | - |
| CA | § 22602(a) `ca_22602_a_notice` | host-evidence | - | - | - |
| CA | § 22602(b)(1) `ca_22602_b_1_content` | covered | self_harm, stance | - | - |
| CA | § 22602(b)(1) `ca_22602_b_1_referral` | partial | - | refers_to_crisis_services | - |
| CA | § 22602(b)(1)-(2) `ca_22602_b_protocol` | host-evidence | - | - | - |
| CA | § 22602(c)(1) `ca_22602_c_1` | host-evidence | - | - | - |
| CA | § 22602(c)(2) `ca_22602_c_2` | host-evidence | - | - | - |
| CA | § 22602(c)(3) `ca_22602_c_3_statement` | covered | sexual_activity, stance | - | host.known_minor |
| CA | § 22602(c)(3) `ca_22602_c_3_visual` | host-evidence | - | - | - |
| CA | § 22603(a), (d) `ca_22603` | host-evidence | - | - | - |
| CA | § 22604 `ca_22604` | host-evidence | - | - | - |

## Summary

| | NY | CA |
|---|---|---|
| units | 13 | 11 |
| covered | 5 | 3 |
| partial | 5 | 1 |
| hostEvidence | 2 | 7 |
| pendingRegulation | 1 | 0 |
| reachableShareAllUnits | 5/13 | 3/11 |
| reachableShareResponseLevel | 5/10 | 3/4 |

- Mention rule heads (apply to every unit): NY is_mention_not_use; CA is_mention_not_use.
- Existing heads used: NY 8 (addresses_own_nature, asserts_interior_state, directed_at_user, is_mention_not_use, self_harm, sexual_activity, stance, untethered_to_content); CA 6 (addresses_own_nature, asserts_interior_state, is_mention_not_use, self_harm, sexual_activity, stance).
- Existing heads CA uses that NY does not: none.
- Union of existing heads used: 8 of 17. Unused by both: violence_person, financial_crime, intrusion, weapons, profanity, targets_protected_characteristic, subject_is_minor, explicit_register, exceeds_common_knowledge.
- New heads NY needs: 6 (claims_relationship_role, disordered_eating, encourages_secrecy, frames_as_own_opinion, probes_user_emotion, substance_misuse). New heads CA needs: 1 (refers_to_crisis_services); beyond NY's: 1 (refers_to_crisis_services).
- Distinct heads needed to cover every response-level unit of both statutes: 15 (8 existing + 7 new).

### Unit pairs sharing a content head (stance alone not counted)

| NY unit | CA unit | Shared heads |
|---|---|---|
| ny_1800_8_a | ca_22602_a_output | addresses_own_nature, asserts_interior_state |
| ny_1800_8_c | ca_22602_a_output | asserts_interior_state |
| ny_1800_8_g | ca_22602_a_output | addresses_own_nature |
| ny_1800_8_i_self_harm | ca_22602_b_1_content | self_harm, stance |
| ny_1800_8_l | ca_22602_c_3_statement | sexual_activity |
