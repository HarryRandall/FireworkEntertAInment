"""Fenced video queue handling, ending with durable measurement evidence for interpretation."""

import argparse
import tempfile
from pathlib import Path
from uuid import UUID, uuid4

from showcrafter_workers.client import Job, JobClient, Settings
from showcrafter_workers.runtime import Usage, drain

from measure import EXTRACTOR, measure
from storage import download, upload_crop


def payload_ids(value: dict) -> tuple[str, str]:
    """Validate the enqueue contract: one pre-created analysis and its exact media UUID."""
    if set(value) != {"analysis_id", "media_id"}:
        raise ValueError("Video payload requires analysis_id and media_id only")
    return str(UUID(value["analysis_id"])), str(UUID(value["media_id"]))


class VideoHandler:
    """Reuse the shared queue client's origin and lease fence for all analysis writes."""

    def __init__(self, client: JobClient):
        """Bind trusted database access without reading credentials during module import."""
        self.client = client

    def transition(self, job: Job, state: str, measurements=None, error=None):
        """Move analysis state only while this exact queue attempt still owns its lease."""
        return self.client.request(
            "POST",
            "/rpc/save_video_measurement",
            {
                "p_job": job.id,
                "p_worker": job.worker,
                "p_attempt": job.attempt,
                "p_state": state,
                "p_extractor": EXTRACTOR,
                "p_measurements": measurements,
                "p_error": error,
            },
        )

    def __call__(self, job: Job, usage: Usage) -> dict:
        """Measure a supplier MP4, upload crops, then atomically expose the complete evidence.

        Repeated jobs reuse installed evidence, including after queue completion fails.
        No interpretation provider is called. Runtime records duration and zero provider
        cost, and owns complete_job/fail_job. Unexpected storage/database failures surface.
        """
        analysis_id, media_id = payload_ids(job.payload)
        analysis = self.transition(job, "measuring")
        if (
            analysis["status"] in ("interpreting", "fitting", "ready")
            or analysis.get("shots") is not None
        ):
            return {
                "analysis_id": analysis_id,
                "media_id": media_id,
                "reused": True,
                "next": "video_fit",
            }
        try:
            rows = self.client.request("GET", f"/media?id=eq.{media_id}")
            if not isinstance(rows, list) or len(rows) != 1:
                raise ValueError("Video media row required")
            with tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                source = root / "source.mp4"
                output = root / "keyframes"
                download(self.client, rows[0], source)
                result = measure(source, analysis["priors"], output)
                self.client.heartbeat(job)
                self.store_keyframes(result, output, analysis_id)
                self.transition(job, "interpreting", result)
        except Exception as error:
            # Persist only the error class; a stale fence cannot touch a new attempt.
            self.transition(job, "failed", error=type(error).__name__)
            raise
        return {
            "analysis_id": analysis_id,
            "media_id": media_id,
            "reused": False,
            "shot_count": len(result["shots"]),
            "next": "video_fit",
        }

    def store_keyframes(self, result: dict, output: Path, analysis_id: str):
        """Replace local crop names with durable imports paths before installing measurements."""
        for shot in result["keyframes"]:
            for label in ("launch", "peak", "fade"):
                shot[label]["path"] = upload_crop(
                    self.client, output / shot[label]["path"], "video/" + analysis_id
                )
                shot[label]["bucket"] = "imports"


def main():
    """Drain a bounded local queue batch, refusing hosted endpoints even if misconfigured."""
    parser = argparse.ArgumentParser(description="Measure local video_analyse jobs")
    parser.add_argument("--max-jobs", type=int, default=1)
    arguments = parser.parse_args()
    client = JobClient(Settings.from_environment(local_only=True))
    drain(
        client,
        {"video_analyse": VideoHandler(client)},
        "local-video-" + str(uuid4()),
        max_jobs=arguments.max_jobs,
    )


if __name__ == "__main__":
    main()
