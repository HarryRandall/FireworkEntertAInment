"""Print fitted worker candidates for a fixture clip, for the app's contract check."""

import json
import sys
from pathlib import Path

SERVICE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE))
sys.path.insert(0, str(SERVICE / "tests"))
from fit import NodeScorer, fit_proposal  # noqa: E402
from measure import measure  # noqa: E402
from test_fit import fixture_proposals  # noqa: E402
from worker import candidate_rows  # noqa: E402

FIXTURES = SERVICE / "tests" / "fixtures"


def main():
    definition = fixture_proposals()["definitions"][1]
    evidence, _ = measure(FIXTURES / "silent-comet.mp4", {"shot_count": 1})
    with NodeScorer() as scorer:
        result = fit_proposal(scorer, evidence, definition["proposal"], max_iterations=1)
        rows = candidate_rows("Contract comet", evidence, evidence, result, scorer)
    json.dump(rows, sys.stdout, separators=(",", ":"))


if __name__ == "__main__":
    main()
