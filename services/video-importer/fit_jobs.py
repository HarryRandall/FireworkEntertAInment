"""Fenced interpretation and fitting with a durable call reservation and offline injection."""

import argparse
import tempfile
import time
from pathlib import Path
from uuid import uuid4

from showcrafter_workers.client import Job, JobClient, Settings
from showcrafter_workers.runtime import Usage, drain

from decode import MAX_DURATION_S, MS_PER_SECOND, probe_video
from fit import NodeScorer, fit_proposal
from interpret import DisabledProvider, VideoProvider, VideoRequest, build_prompt, validate_response
from model_config import MODEL, VIDEO_CAP_USD, actual_cost, estimate_cost
from storage import download
from video_jobs import payload_ids


class FitHandler:
    """Persist results only under the shared queue's unexpired attempt fence."""

    def __init__(self, client: JobClient, provider: VideoProvider | None = None):
        """Inject provider behaviour explicitly; the default cannot call any hosted model."""
        self.client = client
        self.provider = provider or DisabledProvider()

    def step(self, job: Job, action: str, record=None):
        """Apply one transactional lifecycle action; costs use USD and latency uses milliseconds."""
        return self.client.request(
            "POST",
            "/rpc/video_fit_step",
            {
                "p_job": job.id,
                "p_worker": job.worker,
                "p_attempt": job.attempt,
                "p_action": action,
                "p_record": record or {},
            },
        )

    def __call__(self, job: Job, usage: Usage) -> dict:
        """Interpret once then fit, or resume installed candidates without another response."""
        analysis_id, media_id = payload_ids(job.payload)
        state = self.step(job, "read")
        candidates = {row["source"]: row for row in state["candidates"]}
        if "fit" in candidates:
            return {
                "analysis_id": analysis_id,
                "candidate_id": candidates["fit"]["id"],
                "reused": True,
            }
        try:
            with tempfile.TemporaryDirectory() as temporary, NodeScorer() as scorer:
                source = Path(temporary) / "source.mp4"
                media = self.client.request("GET", f"/media?id=eq.{media_id}")
                if not isinstance(media, list) or len(media) != 1:
                    raise ValueError("Video media row required")
                download(self.client, media[0], source)
                video, _ = probe_video(source)
                duration_ms = round(float(video["duration"]) * MS_PER_SECOND)
                if not 0 < duration_ms <= MAX_DURATION_S * MS_PER_SECOND:
                    raise ValueError("Bounded native video duration required")
                analysis = state["analysis"]
                evidence = {
                    "duration_ms": duration_ms,
                    "shots": analysis["shots"],
                    "features": analysis["features"],
                }
                proposal = candidates.get("llm", {}).get("proposal")
                if proposal is None:
                    proposal = self.interpret(job, usage, scorer, evidence, source, state)
                result = fit_proposal(scorer, evidence, proposal)
                candidate = self.step(job, "ready", result["fitted"])
                return {
                    "analysis_id": analysis_id,
                    "candidate_id": candidate["id"],
                    "fit_seconds": result["duration_seconds"],
                    "iterations": result["iterations"],
                    "reused": False,
                }
        except Exception as error:
            self.step(job, "failure", {"error": type(error).__name__})
            raise

    def interpret(self, job, usage, scorer, evidence, source, state):
        """Reserve generation; log complete billed usage before parsing model JSON."""
        if state["call"] is not None:
            raise ValueError("Interpretation already attempted; no paid retry allowed")
        if isinstance(self.provider, DisabledProvider):
            raise RuntimeError("Video provider disabled")
        catalogue = scorer.request({"catalogue": True})
        prompt = build_prompt({**evidence, "priors": state["analysis"]["priors"]}, catalogue)
        estimate = estimate_cost(evidence["duration_ms"], prompt)
        self.step(job, "reserve", {"model": MODEL, **estimate})
        # Retain reserved spend when transport loses a response; do not assume a free failed call.
        usage.provider_usd = estimate["cost_usd"]
        started = time.monotonic()
        response = self.provider.generate(VideoRequest(source, prompt, estimate["tokens_in"]))
        cost = actual_cost(response.tokens_in, response.tokens_out, response.audio_tokens)
        usage.provider_usd = float(cost)
        self.step(
            job,
            "usage",
            {
                "tokens_in": response.tokens_in,
                "tokens_out": response.tokens_out,
                "cost_usd": float(cost),
                "latency_ms": round((time.monotonic() - started) * MS_PER_SECOND),
            },
        )
        if (
            cost > VIDEO_CAP_USD
            or response.tokens_in > estimate["tokens_in"]
            or response.tokens_out > estimate["tokens_out"]
        ):
            raise ValueError("Provider exceeded its reserved token envelope")
        proposal = validate_response(response.text)
        initial = scorer.request({"evidence": evidence, "proposal": proposal})["candidates"][0]
        self.step(job, "interpret", initial)
        return proposal


def main():
    """Drain local fitting jobs with the disabled provider; installed interpretations may resume."""
    parser = argparse.ArgumentParser(
        description="Fit local video candidates without paid API access"
    )
    parser.add_argument("--max-jobs", type=int, default=1)
    arguments = parser.parse_args()
    client = JobClient(Settings.from_environment(local_only=True))
    drain(
        client,
        {"video_fit": FitHandler(client)},
        "local-fit-" + str(uuid4()),
        max_jobs=arguments.max_jobs,
    )


if __name__ == "__main__":
    main()
