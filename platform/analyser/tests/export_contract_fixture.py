"""Emit one Python-validated analyser result for the TypeScript contract test."""

import json
import sys
from pathlib import Path

from test_schema_validation import make_analysis_payload


ANALYSER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ANALYSER_DIR))

from showcrafter import validate_analysis_result  # noqa: E402


if len(sys.argv) != 2:
    raise SystemExit("usage: export_contract_fixture.py OUTPUT_PATH")

output_path = Path(sys.argv[1])
output_path.write_text(
    json.dumps(validate_analysis_result(make_analysis_payload())),
    encoding="utf-8",
)
