# Music analyser

The Modal analyser produces the schema `1.4.0` music-analysis contract. Beat This!
1.1.0 fold 0 is the default beat and downbeat tracker; the pinned checkpoint is
downloaded during the Modal image build and verified against
`beat-this-model.json`.

For local analysis, install the pinned requirements, then download and verify the
same checkpoint:

```bash
python download_model.py
python -m unittest discover -s tests -p '*test*.py'
python evaluate.py
```

Inference runs on CPU and limits Torch to two threads. The image includes the
checkpoint, which increases its build download and image size. The lightweight
`/runs` endpoint does not import analyser, Torch or Beat This! code.

## Labelled beat-tracker evaluation

The Jamendo regression fixtures exercise the full analyser contract, but their
timing samples are regression anchors rather than beat labels. Use the pinned
GuitarSet 1.1.0 annotations for tracker accuracy:

```bash
python download_evaluation.py
python evaluate.py --compare-trackers --report evals/report-local-cpu.json
```

The downloader fetches only the manifest-selected recordings into the ignored
`.cache/guitarset/` directory and verifies each SHA-256 checksum. The comparison
reports macro-average beat F-measure, downbeat F-measure, strict tempo accuracy
and runtime for `librosa` and Beat This!. It never treats Jamendo anchors as
accuracy labels.
