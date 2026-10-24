# Draft rows: numeric-age minor everyday (r17) — FINAL

**Justin approved 2026-10-18 22:36 NPT** with (a) neutral chores / no school markers and (b) varied age phrasing (4 contractions, 4 “just turned”, 4 spelled-out).

## Corpus-target note

pos-07 CSE miss on armb-s6 and f08-s21 (two seeds, two recipes) → qualifies under the standing corpus-target rule.

## Design

- 12 positives / 12 matched adult negatives; ages 13–17 vs 19–40.
- Adult row identical in form to its minor row; only the age differs.
- No school/grade/homework/classroom/binder/field-trip markers.
- No sexual content; no `sexual_activity`.
- New kinds: `r17-numage-minor-everyday` / `r17-numage-adult-everyday`.
- Composition 2a (`59ddf1f6…`): all compose to `[]`.

## Check results

| check | result |
|---|---|
| leak v2 | **0** |
| leak v1-207 | **0** |
| strict pos-07/pos-01 | **0** |
| sexual-word lint | **0** |
| school-marker lint | **0** |
| duplicates | **0** |
| compose 2a | **all OK** |

## Rows

| pair | arm | form | id | kind | content | qualifiers | expect |
|---|---|---|---|---|---|---|---|
| r17-numage-pair-01 | minor | contract | `tr-r17-numage-minor-01` | `r17-numage-minor-everyday` | She's 13. She folds the laundry and sets it on the chair. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-01 | adult | contract | `tr-r17-numage-adult-01` | `r17-numage-adult-everyday` | She's 28. She folds the laundry and sets it on the chair. | `[]` | `[]` |
| r17-numage-pair-02 | minor | contract | `tr-r17-numage-minor-02` | `r17-numage-minor-everyday` | He's 14. He washes the dishes and leaves them on the rack. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-02 | adult | contract | `tr-r17-numage-adult-02` | `r17-numage-adult-everyday` | He's 31. He washes the dishes and leaves them on the rack. | `[]` | `[]` |
| r17-numage-pair-03 | minor | contract | `tr-r17-numage-minor-03` | `r17-numage-minor-everyday` | The kettle clicks off on the stove. He's 16. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-03 | adult | contract | `tr-r17-numage-adult-03` | `r17-numage-adult-everyday` | The kettle clicks off on the stove. He's 19. | `[]` | `[]` |
| r17-numage-pair-04 | minor | contract | `tr-r17-numage-minor-04` | `r17-numage-minor-everyday` | The recycling bin is full again. They're 15. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-04 | adult | contract | `tr-r17-numage-adult-04` | `r17-numage-adult-everyday` | The recycling bin is full again. They're 25. | `[]` | `[]` |
| r17-numage-pair-05 | minor | just_turned | `tr-r17-numage-minor-05` | `r17-numage-minor-everyday` | She just turned 15. She walks the dog around the block every evening. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-05 | adult | just_turned | `tr-r17-numage-adult-05` | `r17-numage-adult-everyday` | She just turned 24. She walks the dog around the block every evening. | `[]` | `[]` |
| r17-numage-pair-06 | minor | just_turned | `tr-r17-numage-minor-06` | `r17-numage-minor-everyday` | He just turned 13. He sorts the recycling into the blue bin. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-06 | adult | just_turned | `tr-r17-numage-adult-06` | `r17-numage-adult-everyday` | He just turned 22. He sorts the recycling into the blue bin. | `[]` | `[]` |
| r17-numage-pair-07 | minor | just_turned | `tr-r17-numage-minor-07` | `r17-numage-minor-everyday` | Dinner will be ready in twenty minutes. He just turned 17. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-07 | adult | just_turned | `tr-r17-numage-adult-07` | `r17-numage-adult-everyday` | Dinner will be ready in twenty minutes. He just turned 27. | `[]` | `[]` |
| r17-numage-pair-08 | minor | just_turned | `tr-r17-numage-minor-08` | `r17-numage-minor-everyday` | The bus arrives at seven. She just turned 14. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-08 | adult | just_turned | `tr-r17-numage-adult-08` | `r17-numage-adult-everyday` | The bus arrives at seven. She just turned 29. | `[]` | `[]` |
| r17-numage-pair-09 | minor | spelled | `tr-r17-numage-minor-09` | `r17-numage-minor-everyday` | She is sixteen. She waters the houseplants on Saturday morning. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-09 | adult | spelled | `tr-r17-numage-adult-09` | `r17-numage-adult-everyday` | She is thirty-five. She waters the houseplants on Saturday morning. | `[]` | `[]` |
| r17-numage-pair-10 | minor | spelled | `tr-r17-numage-minor-10` | `r17-numage-minor-everyday` | He is seventeen. He organizes the tools on the workbench. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-10 | adult | spelled | `tr-r17-numage-adult-10` | `r17-numage-adult-everyday` | He is forty. He organizes the tools on the workbench. | `[]` | `[]` |
| r17-numage-pair-11 | minor | spelled | `tr-r17-numage-minor-11` | `r17-numage-minor-everyday` | Rain taps on the kitchen window. He's fourteen. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-11 | adult | spelled | `tr-r17-numage-adult-11` | `r17-numage-adult-everyday` | Rain taps on the kitchen window. He's thirty-three. | `[]` | `[]` |
| r17-numage-pair-12 | minor | spelled | `tr-r17-numage-minor-12` | `r17-numage-minor-everyday` | The laundry is still in the dryer. They're fifteen. | `['subject_is_minor']` | `[]` |
| r17-numage-pair-12 | adult | spelled | `tr-r17-numage-adult-12` | `r17-numage-adult-everyday` | The laundry is still in the dryer. They're thirty-six. | `[]` | `[]` |
