"""Seeded bounded CMA-ES with all feature scoring delegated to the canonical Node CPU simulation."""

import json
import selectors
import shutil
import subprocess
import time
from pathlib import Path

import cma

# Per-video budgets: 30 generations/effect, eight candidates/generation, five minutes total.
MAX_ITERATIONS = 30
POPULATION_SIZE = 8
WALL_CLOCK_SECONDS = 300
# Normalised search sigma and fixed RNG seed, repeatable visual fitting tuning.
INITIAL_SIGMA = 0.15
FIT_SEED = 17
# CMA's documented quiet verbosity level; stdout belongs to structured worker logs.
CMA_QUIET = -9
REPOSITORY = Path(__file__).resolve().parents[2]


class NodeScorer:
    """Persistent JSON-lines subprocess, with a deadline covering startup and every render batch."""

    def __init__(self, seconds: float = WALL_CLOCK_SECONDS):
        """Start the TypeScript scorer with a monotonic deadline in seconds."""
        self.deadline = time.monotonic() + seconds
        self.process = subprocess.Popen(
            [
                shutil.which("node") or "node",
                "--import",
                str(REPOSITORY / "scripts/register-typescript.mjs"),
                str(REPOSITORY / "packages/video-fit/src/bridge.ts"),
            ],
            cwd=REPOSITORY,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )

    def request(self, value: dict) -> dict:
        """Score a bounded candidate batch; reject crashed, malformed or overdue Node responses."""
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("Video fitting wall budget exhausted")
        self.process.stdin.write(json.dumps(value, allow_nan=False) + "\n")
        self.process.stdin.flush()
        with selectors.DefaultSelector() as selector:
            selector.register(self.process.stdout, selectors.EVENT_READ)
            if not selector.select(remaining):
                raise TimeoutError("Node simulation deadline exhausted")
        line = self.process.stdout.readline()
        if not line:
            raise RuntimeError("Node scorer exited")
        result = json.loads(line)
        if "error" in result:
            raise ValueError(result["error"])
        return result

    def __enter__(self):
        """Return this scorer for a guaranteed subprocess cleanup scope."""
        return self

    def __exit__(self, *args):
        """Kill and reap the subprocess on every success, failure and timeout."""
        self.process.kill()
        self.process.wait()
        self.process.stdin.close()
        self.process.stdout.close()


def fit_proposal(scorer: NodeScorer, evidence: dict, proposal: dict) -> dict:
    """Refine four to six canonical numbers/effect with full-covariance CMA-ES, retaining the best.

    Input evidence uses ms from video start. All search coordinates are normalised
    [0,1]; Node returns per-feature distances and overall similarity. A deadline
    failure aborts rather than storing a partial result. Input proposal is untouched.
    """
    started = time.monotonic()
    initial = scorer.request({"evidence": evidence, "proposal": proposal})
    best = initial["candidates"][0]
    iterations = {}
    for letter, metadata in initial["effects"].items():
        optimiser = cma.CMAEvolutionStrategy(
            metadata["initial"],
            INITIAL_SIGMA,
            {
                "seed": FIT_SEED,
                "bounds": [0, 1],
                "popsize": POPULATION_SIZE,
                "maxiter": MAX_ITERATIONS,
                "verbose": CMA_QUIET,
                "verb_log": 0,
            },
        )
        # Fixed base keeps normalised parameter bounds identical throughout this effect search.
        base = best["proposal"]
        for generation in range(MAX_ITERATIONS):
            vectors = optimiser.ask()
            result = scorer.request(
                {
                    "evidence": evidence,
                    "proposal": base,
                    "letter": letter,
                    "vectors": [vector.tolist() for vector in vectors],
                }
            )
            candidates = result["candidates"]
            optimiser.tell(vectors, [1 - candidate["overall"] for candidate in candidates])
            winner = max(candidates, key=lambda candidate: candidate["overall"])
            if winner["overall"] > best["overall"]:
                best = winner
            iterations[letter] = generation + 1
            if optimiser.stop():
                break
    return {
        "initial": initial["candidates"][0],
        "fitted": best,
        "duration_seconds": time.monotonic() - started,
        "iterations": iterations,
        "parameters": initial["effects"],
    }
