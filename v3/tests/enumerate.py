"""Python twin of tests/enumerate.mjs (same iteration order and hash input)."""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from airp_v3.compose import compose, load_composition, STANCES  # noqa: E402

OBJ = ['violence_person', 'self_harm', 'sexual_activity', 'financial_crime', 'intrusion', 'weapons', 'profanity']
QUAL = ['targets_protected_characteristic', 'subject_is_minor', 'asserts_interior_state', 'addresses_own_nature',
        'explicit_register', 'exceeds_common_knowledge', 'is_mention_not_use', 'directed_at_user', 'untethered_to_content']


def run(comp):
    h = hashlib.sha256()
    n = fired = 0
    for stance in STANCES:
        for m in range(1 << 16):
            objects = [o for i, o in enumerate(OBJ) if m & (1 << i)]
            quals = [q for i, q in enumerate(QUAL) if m & (1 << (i + 7))]
            got = compose({"stance": stance, "objects": objects, "qualifiers": quals}, comp)
            fired += bool(got)
            h.update(f"{stance}|{m}|{','.join(got)}\n".encode())
            n += 1
    return {"n": n, "fired": fired, "sha256": h.hexdigest()}


if __name__ == "__main__":
    print(json.dumps(run(load_composition(sys.argv[1] if len(sys.argv) > 1 else None))))
