"""Origin-bound private Storage access for supplier MP4s and content-addressed crops."""

import hashlib
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, build_opener

from showcrafter_workers.client import DatabaseError, JobClient, NoRedirects

from decode import MAX_BYTES

# Operational transfer deadline in seconds for a bounded local/object-store request.
STORAGE_TIMEOUT_S = 60
DOWNLOAD_BLOCK_BYTES = 64 * 1024
# Source bucket allowlist reflects the database's existing supplier/catalogue video buckets.
SOURCE_BUCKETS = {"imports", "catalogue-media"}


def object_path(value: str) -> str:
    """Require a relative object key without traversal, control characters or URL syntax."""
    if not isinstance(value, str) or not value or value.startswith("/"):
        raise ValueError("Relative storage path required")
    if any(part in ("", ".", "..") for part in value.split("/")) or re.search(
        r"[\x00-\x1f\x7f\\?#]", value
    ):
        raise ValueError("Unsafe storage path")
    return quote(value, safe="/")


def storage_request(client: JobClient, method: str, endpoint: str, data=None, mime=None):
    """Open only the configured Storage origin; never forward credentials on a redirect."""
    headers = {
        "apikey": client.settings.service_role_key,
        "Authorization": "Bearer " + client.settings.service_role_key,
    }
    if mime:
        headers.update({"Content-Type": mime, "x-upsert": "true"})
    request = Request(
        client.settings.url + "/storage/v1/" + endpoint, data=data, method=method, headers=headers
    )
    try:
        return build_opener(NoRedirects()).open(request, timeout=STORAGE_TIMEOUT_S)
    except HTTPError as error:
        error.close()
        raise DatabaseError(f"Video storage failed (HTTP {error.code})") from None
    except (URLError, OSError, TimeoutError):
        raise DatabaseError("Video storage transport failed") from None


def download(client: JobClient, media: dict, target: Path) -> None:
    """Download a bounded video row's private object and verify its stored size and SHA-256."""
    if (
        media["kind"] != "video"
        or media["mime"] != "video/mp4"
        or media["bucket"] not in SOURCE_BUCKETS
    ):
        raise ValueError("Private supplier MP4 required")
    if type(media["bytes"]) is not int or not 0 < media["bytes"] <= MAX_BYTES:
        raise ValueError("Video exceeds byte budget")
    if not re.fullmatch(r"[0-9a-f]{64}", media["sha256"]):
        raise ValueError("Video hash required")
    endpoint = "object/authenticated/" + media["bucket"] + "/" + object_path(media["path"])
    total = 0
    digest = hashlib.sha256()
    with storage_request(client, "GET", endpoint) as response, target.open("wb") as output:
        while block := response.read(DOWNLOAD_BLOCK_BYTES):
            total += len(block)
            if total > media["bytes"]:
                raise ValueError("Storage object exceeds declared size")
            digest.update(block)
            output.write(block)
    if total != media["bytes"] or digest.hexdigest() != media["sha256"]:
        raise ValueError("Video integrity check failed")


def upload_crop(client: JobClient, path: Path, prefix: str) -> str:
    """Store a content-addressed PNG in imports; retrying writes the identical object."""
    data = path.read_bytes()
    key = prefix + "/" + hashlib.sha256(data).hexdigest() + ".png"
    with storage_request(
        client, "POST", "object/imports/" + object_path(key), data, "image/png"
    ) as response:
        response.read()
    return key
