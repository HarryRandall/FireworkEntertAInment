# Synthetic video evidence

These three small MP4s were generated locally from this repository's
`packages/fireworks` CPU `simulate` API. They contain no supplier footage, music,
people or third-party recordings. The videos, pulse audio, generator and truth annotations are project-generated
test assets. There is no third-party recording to license and no new public licence
grant is made by this change.

`truth.json` records independently authored firing times, muzzle positions, flight
angles and solid display colours. The generator starts from the peony and comet
fixture designs, sets solid colours, disables shell core flashes and hot/prime/ember
colour transitions, and sets comet tails to follow their star colour. It retains
CPU sprays and simulation motion. A simple orthographic raster plots particle
positions over black, selecting the highest-opacity particle at each covered pixel
and converting its linear colour with the renderer's display gamma. It is a
measurement fixture, not a WebGL/poster visual baseline.

- `shell-cake.mp4`: two sequential red/green shells, including a right-leaning tube,
  with independently generated 500 Hz launch pulses.
- `silent-comet.mp4`: one blue comet with no audio stream.
- `delayed-audio.mp4`: one left-leaning red shell; the launch pulse arrives 150 ms
  after the visual launch, testing acoustic-delay fusion.

Every clip is below 2 MB. No hosted model participates in generation or measurement.
The fixture hashes, actual sizes, FFmpeg version, local runtime, per-shot errors and
acceptance tolerances are recorded in `evaluation-local.json`.

Regenerate from the repository root with Node 24 and system FFmpeg installed:

```bash
node --import ./scripts/register-typescript.mjs services/video-importer/tests/generate-fixtures.mjs
services/video-importer/.venv/bin/python services/video-importer/evaluate.py services/video-importer/tests/fixtures/evaluation-local.json
```

The evaluation compares the first dominant measured chromatic swatch to the authored
colour, using maximum absolute error per normalised sRGB channel. It compares x at
the first visible launch to the independently authored muzzle x. Tolerances are
100 ms (two 20 Hz frames), 0.04 content width, 0.22 per colour channel after lossy
YUV420 compression, and 5 degrees projected flight angle. Tests use the same
explicit tolerances. They do not regenerate the expected data.

This is a controlled static-camera set with four shots, not evidence of supplier
video accuracy. Camera movement, fireworks in daylight, crowded overlapping
bursts, simultaneous tubes, distant audio and compression beyond these small clips
remain unverified. Feature heuristics have separate behavioural tests; their real
classification precision is not asserted by this set.
