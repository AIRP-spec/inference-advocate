import json
# Composed locally from the slot spec below. No writer model was called. Labels come ONLY from the kind entries.
A_CRUDE=[  # r15-sx-terse-crude: adult explicit, crude register, no age reference (bnd-02 shape side: subject_is_minor must stay off)
"He pins her wrists to the mattress and fucks her slow and deep.",
"Her mouth works his cock while he grips the headboard.",
"She spreads her thighs; he licks her.",
"Panel four: fucking on the couch, half-dressed.",
"He comes across her stomach, laughing.",
"Rough anal on the desk, both of them moaning.",
"The camera stays on them as she bounces on his lap, slick and loud.",
"Fingers inside her, thumb on her clit.",
"She straddles his face and grinds down hard.",
"The bride and groom skip the reception and fuck in the coat room.",
]
A_PLAIN=[  # r15-sx-terse-plain: adult sexual activity, non-crude wording, no age reference
"Two strangers from the bar, naked on the hotel floor, moving together until they both come.",
"Caption: a married couple making love on the kitchen counter at dawn.",
"Three adults, one bed, nobody quiet.",
"Slow, sweaty sex against the shower wall, the water gone cold by the end.",
"The two of them tangled on a beach towel, kissing their way down each other's bodies.",
"Next chapter: a long night of car sex.",
]
B=[  # r15-refuse-terse-adult: refusal / house-rule line naming adult sexual content only (ctr-03 shape, sexual half; no minor)
"No porn, no nudes, no sexting on this account.",
"Hard limits: nothing explicit, no sex scenes, no erotic roleplay.",
"I won't write the sex scene, not even a fade-to-black version.",
"Not here. No explicit stories, no dirty talk, no hookups arranged.",
"Sexual content is off the table for this assistant, full stop.",
"No erotica, no fetish requests, no graphic bedroom detail.",
"That's a no on the strip-club roleplay and on the explicit photos.",
"House rule: zero sexual material, whether it's a story, a caption, or a joke.",
"Skip the steamy part. I don't produce adult content.",
"No nude images, no OnlyFans scripts, no explicit chat.",
"Keep it clean: no sex acts described, no innuendo-heavy flirting.",
"I'm not going to describe anyone undressing or having sex.",
]
C=[  # r15-refuse-terse-minor-nonsexual: refusal / house-rule line naming minors with NON-sexual categories only (ctr-03 shape, minor half)
"No weapon advice for kids, no gore, no dares that could hurt someone.",
"No help buying alcohol or vapes for anyone still in high school.",
"No self-harm talk with children; I'll point them to a trusted adult instead.",
"Hard limits for teen mode: no slurs, no violence, no gambling tips.",
"I won't help a twelve-year-old sneak out at night or hitch a ride with strangers.",
"No fight videos of schoolkids, no bullying scripts, no threats.",
"Not for anyone under sixteen: no energy-drink challenges, no fireworks how-to.",
"This kids' account blocks profanity, scary violence, and weapons content.",
"No instructions to a child on mixing cleaning chemicals, ever.",
"No stalking tools, no doxxing, nothing that tracks a teenager's location for strangers.",
"Minors get no drug-dosing advice from me, however they ask.",
"No hate speech, no horror gore, nothing violent in the children's story mode.",
]
KT={
 "r15-sx-terse-crude":{"stance":"depicts","objects":["sexual_activity"],"qualifiers":["explicit_register"],"expect":["sexual_content"],"needsTiebreaker":False,
   "reason":"r15 CSE-shape round: terse adult explicit (crude) with no age reference; mirrors sexual_content-crude. Target: subject_is_minor off on bnd-02-shaped text."},
 "r15-sx-terse-plain":{"stance":"depicts","objects":["sexual_activity"],"qualifiers":[],"expect":["sexual_content"],"needsTiebreaker":False,
   "reason":"r15 CSE-shape round: terse adult sexual activity, non-crude wording, no age reference; mirrors sexual_content-literary."},
 "r15-refuse-terse-adult":{"stance":"describes","objects":[],"qualifiers":["is_mention_not_use"],"expect":[],"needsTiebreaker":False,
   "reason":"r15 CSE-shape round: terse negation-list refusal naming adult sexual content only; mirrors class-refusal / refusal-naming-category (sexual_activity off: named, not enacted)."},
 "r15-refuse-terse-minor-nonsexual":{"stance":"describes","objects":[],"qualifiers":["is_mention_not_use"],"expect":[],"needsTiebreaker":False,
   "reason":"r15 CSE-shape round: terse negation-list refusal naming minors with non-sexual categories only. subject_is_minor = no per settled proxy (minor ⇔ CSE in gold) and the existing refusal convention (142 corpus refusals with minor words all label it no)."},
}
rows=[]
for kind,arr in (("r15-sx-terse-crude",A_CRUDE),("r15-sx-terse-plain",A_PLAIN),("r15-refuse-terse-adult",B),("r15-refuse-terse-minor-nonsexual",C)):
  for i,t in enumerate(arr,1):
    L=KT[kind]; rows.append({"id":f"tr-r15-cse-shape-{kind[4:]}-{i:02d}","kind":kind,"path":"composed","content":t,"expect":L["expect"],
      "stance":L["stance"],"objects":L["objects"],"qualifiers":L["qualifiers"],"tiebreaker":False,"draft":True})
with open("rows-draft.jsonl","w") as f:
  for r in rows: f.write(json.dumps(r,ensure_ascii=False)+"\n")
json.dump({"note":"PROPOSED ONLY. Not applied to primitives/kind-label-table.json, recipe.json, labels-v5 or any split. Labels for every row come from these kind entries, never per row; no writer model.","table":KT,
 "proposedRecipeEntry":{"id":"r15-cse-shape","count":len(rows),"path":"composed","arms":{k:sum(r['kind']==k for r in rows) for k in KT},"split":"train only (new group ids)"}},
 open("proposed-kind-table-additions.json","w"),indent=2,ensure_ascii=False)
print(len(rows),{k:sum(r['kind']==k for r in rows) for k in KT})
