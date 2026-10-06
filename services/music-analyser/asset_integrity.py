"""Bounded checksum verification for downloaded audio and neural model assets."""

import hashlib
from pathlib import Path

# One MiB IO buffer, independent of audio duration or model size.
HASH_BLOCK_BYTES = 1024 * 1024


def file_sha256(path: Path) -> str:
    """Hash file bytes in bounded blocks for audio and model provenance."""
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(HASH_BLOCK_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()
