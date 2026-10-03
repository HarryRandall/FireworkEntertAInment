"""Install the approved MIT neural checkpoint with an exact SHA-256 check."""

import json
import urllib.request
from pathlib import Path

from asset_integrity import file_sha256

SERVICE = Path(__file__).resolve().parent
# One MiB chunks and a 60-second socket timeout bound download buffers and stalls.
DOWNLOAD_BLOCK_BYTES = 1024 * 1024
DOWNLOAD_TIMEOUT_SECONDS = 60


def download_model() -> Path:
    """Fetch pinned weights into the ignored cache; never accept changed model bytes."""
    manifest = json.loads((SERVICE / "beat-this-model.json").read_text())
    path = SERVICE / ".cache/fold0.ckpt"
    if path.is_file() and file_sha256(path) == manifest["sha256"]:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".part")
    with (
        urllib.request.urlopen(
            manifest["url"], timeout=DOWNLOAD_TIMEOUT_SECONDS
        ) as source,
        temporary.open("wb") as target,
    ):
        for block in iter(lambda: source.read(DOWNLOAD_BLOCK_BYTES), b""):
            target.write(block)
    if file_sha256(temporary) != manifest["sha256"]:
        temporary.unlink()
        raise ValueError("Neural checkpoint checksum mismatch")
    temporary.replace(path)
    return path


if __name__ == "__main__":
    download_model()
