# Offline music fixtures

`clicks.wav` is a ten-second, mono, 22,050 Hz PCM click train with a quiet rising
220 Hz tonal bed. It was generated for these tests and is dedicated to the public
domain under CC0. No recording or Jamendo download is used.

`analysis.json` is the shared hand-authored schema fixture. Both Python and the
planner consume it, along with `schema-mutations.json`. The cross-language test
also analyses synthetic audio and validates the actual producer output.
