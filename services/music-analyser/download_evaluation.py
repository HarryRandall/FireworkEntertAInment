"""Fetch only manifest-selected GuitarSet recordings into an ignored local cache."""

import io
import json
import urllib.request
import zipfile
from pathlib import Path

from asset_integrity import file_sha256

SERVICE = Path(__file__).resolve().parent
# Zenodo published archive lengths in bytes, used to seek ZIP central directories.
ARCHIVES = {"audio_mono-mic.zip": 656927981, "annotation.zip": 39132574}
SOURCE = "https://zenodo.org/records/3371780/files/"
# Bounded request deadline in seconds; selected members are only a few MiB each.
DOWNLOAD_TIMEOUT_SECONDS = 60
# Retry truncated byte ranges at most three times without advancing the ZIP position.
MAX_RANGE_ATTEMPTS = 3


class RemoteZip(io.RawIOBase):
    """Expose seek/read over exact HTTP byte ranges without downloading a full archive."""

    def __init__(self, archive: str):
        """Open a read-only stream for one fixed published archive."""
        self.url = SOURCE + archive
        self.size = ARCHIVES[archive]
        self.position = 0

    def seekable(self) -> bool:
        """Tell ZipFile that the remote byte stream supports random access."""
        return True

    def seek(self, offset: int, whence: int = 0) -> int:
        """Seek by bytes relative to start, current position or published archive end."""
        origin = {0: 0, 1: self.position, 2: self.size}[whence]
        self.position = origin + offset
        return self.position

    def tell(self) -> int:
        """Return the byte offset consumed by the next range request."""
        return self.position

    def read(self, size: int = -1) -> bytes:
        """Read an exact bounded range; reject servers returning a whole archive."""
        remaining = self.size - self.position
        length = remaining if size < 0 else min(size, remaining)
        if length <= 0:
            return b""
        end = self.position + length - 1
        request = urllib.request.Request(
            self.url, headers={"Range": f"bytes={self.position}-{end}"}
        )
        for _ in range(MAX_RANGE_ATTEMPTS):
            with urllib.request.urlopen(
                request, timeout=DOWNLOAD_TIMEOUT_SECONDS
            ) as response:
                expected = f"bytes {self.position}-{end}/{self.size}"
                if (
                    response.status != 206
                    or response.headers.get("Content-Range") != expected
                ):
                    raise ValueError("Exact archive range required")
                content = response.read(length + 1)
            if len(content) == length:
                self.position += length
                return content
        raise ValueError("Incomplete archive range after bounded retries")


def download() -> None:
    """Install only pinned full recordings; hashes detect changed source bytes."""
    manifest = json.loads((SERVICE / "evals/guitarset.json").read_text())
    with zipfile.ZipFile(RemoteZip("audio_mono-mic.zip")) as archive:
        for track in manifest["tracks"]:
            path = SERVICE / track["audio_path"]
            if path.is_file() and file_sha256(path) == track["audio_sha256"]:
                continue
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(".part")
            temporary.write_bytes(archive.read(track["audio_member"]))
            if file_sha256(temporary) != track["audio_sha256"]:
                temporary.unlink()
                raise ValueError("Dataset member checksum mismatch")
            temporary.replace(path)
            print(track["id"], flush=True)


if __name__ == "__main__":
    download()
