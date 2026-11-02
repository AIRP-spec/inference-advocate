import sys
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
for p in (HERE, HERE / "pack", HERE / "tests"):
    sys.path.insert(0, str(p))
