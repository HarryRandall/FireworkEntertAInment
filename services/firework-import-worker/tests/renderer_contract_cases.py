"""Actual worker payloads consumed by the Node renderer contract check."""

import json

from test_reconstruction import (
    GEOMETRY_CASES,
    build_renderer_reconstruction,
    make_spec,
    renderer_tuning,
    video_observations,
)


def candidate(
    geometry, effect_slug, trail_profile, *, rate=12.5, fade=0.25, times=(1, 2, 3, 4), count=199,
):
    spec = make_spec()
    identity = {
        "geometry": geometry,
        "effectSlug": effect_slug,
        "trailProfile": trail_profile,
    }
    spec["effectSpec"]["shell"].update({**identity, "pistil": effect_slug == "pistil"})
    shot = spec["effectSpec"]["shots"][0]
    shot.update(identity)
    shot["rendererTuning"] = renderer_tuning(emissionRate=rate, starCount=count, burstFlashIntensity=0.75)
    observations = video_observations()
    if geometry in {"fountain", "roman_candle"}:
        shot.update(timeOffsetSeconds=0.5, burstTimeSeconds=1, liftTimeSeconds=0)
        observations["durationSeconds"] = 5
        source = observations["bursts"][0]
        observations["bursts"] = [
            {
                **source,
                "launchSeconds": time,
                "burstSeconds": time,
                "peakSeconds": time,
                "endSeconds": time + fade,
                "fadeSeconds": fade,
                "liftSeconds": 0,
            }
            for time in times
        ]
    return build_renderer_reconstruction(
        spec, observations, {"hasAudio": False}, {"scores": []},
    )


if __name__ == "__main__":
    cases = [candidate(*identity) for identity in GEOMETRY_CASES]
    cases.append(candidate("fountain", "fountain", "spray", rate=25))
    cases.append(candidate("fountain", "fountain", "spray", fade=0.5))
    cases.append(
        candidate("fountain", "fountain", "spray", rate=600, fade=0.25, times=(1,))
    )
    cases.append(candidate("waterfall", "waterfall", "waterfall", count=10))
    print(json.dumps(cases))
