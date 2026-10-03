"""Evaluate synthetic MP4 fits against known parameters without a hosted interpretation call."""

import json
import platform
import subprocess
import tempfile
from pathlib import Path

from fit import (
    FIT_SEED,
    MAX_ITERATIONS,
    POPULATION_SIZE,
    REPOSITORY,
    WALL_CLOCK_SECONDS,
    NodeScorer,
    fit_proposal,
)
from interpret import build_prompt
from measure import measure
from model_config import MODEL, PRICE_DATE, estimate_cost

FIXTURES = Path(__file__).parent / "tests/fixtures"


def numeric_path(design, path):
    """Read an evaluation truth field in its canonical metres, seconds or dimensionless units."""
    value = design
    for key in path.split("."):
        value = value[int(key)] if isinstance(value, list) else value[key]
    return value


def evaluate():
    """Fit biased synthetic proposals and report local measurements and parameter recovery."""
    records = json.loads(
        subprocess.check_output(
            [
                "node",
                "--import",
                str(REPOSITORY / "scripts/register-typescript.mjs"),
                str(REPOSITORY / "packages/video-fit/tests/fixtures.mjs"),
            ],
            cwd=REPOSITORY,
        )
    )
    reports = []
    for definition in records["definitions"]:
        with tempfile.TemporaryDirectory() as temporary:
            evidence = measure(
                FIXTURES / (definition["name"] + ".mp4"),
                {"shot_count": len(definition["proposal"]["composition"]["tubes"])},
                Path(temporary),
            )
        with NodeScorer() as scorer:
            catalogue = scorer.request({"catalogue": True})
            estimate = estimate_cost(evidence["duration_ms"], build_prompt(evidence, catalogue))
            result = fit_proposal(scorer, evidence, definition["proposal"])
        recovered = {}
        for letter, metadata in result["parameters"].items():
            design = result["fitted"]["proposal"]["effects"][letter]["overrides"]
            truth = definition["truthDesigns"][letter]
            recovered[letter] = [
                {
                    "path": parameter["path"],
                    "truth": numeric_path(truth, parameter["path"]),
                    "initial": numeric_path(metadata["design"], parameter["path"]),
                    "recovered": numeric_path(design, parameter["path"]),
                    "absolute_error": abs(
                        numeric_path(design, parameter["path"])
                        - numeric_path(truth, parameter["path"])
                    ),
                }
                for parameter in metadata["parameters"]
            ]
        reports.append(
            {
                "name": definition["name"],
                "estimate": estimate,
                "llm_candidate": result["initial"],
                "fit_candidate": result["fitted"],
                "parameters": recovered,
                "fit_seconds": result["duration_seconds"],
                "iterations": result["iterations"],
            }
        )
    return {
        "model": MODEL,
        "price_date": PRICE_DATE,
        "machine": platform.platform(),
        "provider": "synthetic classification; zero paid calls",
        "seed": FIT_SEED,
        "budgets": {
            "iterations_per_effect": MAX_ITERATIONS,
            "population": POPULATION_SIZE,
            "wall_seconds_per_video": WALL_CLOCK_SECONDS,
        },
        "clips": reports,
    }


if __name__ == "__main__":
    report = evaluate()
    (FIXTURES / "fit-evaluation-local.json").write_text(json.dumps(report, indent=2) + "\n")
    for clip in report["clips"]:
        print(
            clip["name"],
            clip["llm_candidate"]["overall"],
            clip["fit_candidate"]["overall"],
            clip["fit_seconds"],
            clip["estimate"]["cost_usd"],
        )
