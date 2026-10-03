"""Export the producer's Pydantic JSON Schema for checked-in planner validation."""

import json

from showcrafter import AnalysisResultModel

if __name__ == "__main__":
    print(json.dumps(AnalysisResultModel.model_json_schema(), indent=2) + "\n", end="")
