# Jamendo analyser fixtures

Audio in this directory must be imported with
`platform/analyser/jamendo_fixture_importer.py`. Every MP3 must have a matching
entry in `platform/analyser/evals/jamendo_fixtures.json` recording its source,
Creative Commons licence, attribution, size, and SHA-256.

Imported tracks begin as candidates. Do not add one to the CI regression
baseline until its musical summary has been reviewed.

The checked-in baseline contains:

- `jamendo_1930820.mp3`, Upbeat Summer Modern Dance Pop by Sevennotes.
- `jamendo_1891977.mp3`, My Love by MODUS.
- `jamendo_360552.mp3`, Antonio Vivaldi: Four Seasons - Excerpt 1 by Marco
  Tezza.
- `jamendo_1930003.mp3`, Contrapunctus No 2 by CHASMA.

Each track is licensed CC BY 3.0. The canonical source URLs, attribution,
licence details, sizes, and SHA-256 values are recorded in
`platform/analyser/evals/jamendo_fixtures.json`.
