# Music Analyzer Spot Check

Use this folder for FIR-39 real-song spot checks.

## Input

Put 3-4 local audio files in:

```bash
prototypes/audio-analyser/spot-check/inputs/
```

Supported formats should include common files that `librosa`/`soundfile` can read,
such as `.mp3`, `.wav`, `.m4a`, `.flac`, and `.aac`.

The current spot-check set intentionally keeps the selected audio files in
`inputs/` so the generated analysis can be reproduced from the repository.
Before adding more tracks, confirm they are acceptable to store in the project.

## Run

From the repository root:

```bash
bash prototypes/audio-analyser/spot-check/run_spot_check.sh
```

The script writes one output folder per song under:

```bash
prototypes/audio-analyser/spot-check/outputs/
```

Each song folder contains:

- `analysis.json` — full analyzer output
- `compact_payload.json` — compact downstream payload
- `report.md` — readable analysis report
- `run.log` — runtime and command output

## Review

Update `notes.md` after each run. The main Sprint 3 check is practical:

- Are sections / chorus / drop labels mostly reasonable?
- Are key moments near the musical peaks?
- Are build-ups useful and not too noisy?
- Is the runtime acceptable for a 3-4 minute track?
- Is anything clearly wrong enough to tune before demo?
