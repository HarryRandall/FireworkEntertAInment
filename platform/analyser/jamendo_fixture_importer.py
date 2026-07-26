"""
Search and import fixed Jamendo tracks for analyser regression evaluation.

Jamendo requires a client ID for every API call. The testing ID published in
its documentation is currently suspended, so this tool fails clearly unless a
working client ID is supplied explicitly, through the environment, or through
the analyser's gitignored .env.local file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


ANALYSER_DIR = Path(__file__).resolve().parent
REPOSITORY_ROOT = ANALYSER_DIR.parents[1]
DEFAULT_AUDIO_DIR = REPOSITORY_ROOT / "data" / "media" / "audio" / "jamendo"
DEFAULT_MANIFEST = ANALYSER_DIR / "evals" / "jamendo_fixtures.json"
LOCAL_ENV_PATH = ANALYSER_DIR / ".env.local"
JAMENDO_TRACKS_URL = "https://api.jamendo.com/v3.0/tracks/"
MAX_API_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_AUDIO_BYTES = 50 * 1024 * 1024
DEFAULT_TIMEOUT_SECONDS = 30
USER_AGENT = "ShowCrafter-Jamendo-Fixture-Importer/1.0"
CC_LICENCE_RE = re.compile(
    r"creativecommons\.org/licenses/(?P<code>[a-z-]+)/(?P<version>[^/]+)/?",
    re.IGNORECASE,
)

UrlOpener = Callable[..., Any]


class ImporterError(RuntimeError):
    pass


def read_local_client_id(path: Path = LOCAL_ENV_PATH) -> str:
    if not path.exists():
        return ""

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() != "JAMENDO_CLIENT_ID":
            continue
        configured = value.strip()
        if (
            len(configured) >= 2
            and configured[0] == configured[-1]
            and configured[0] in {'"', "'"}
        ):
            configured = configured[1:-1].strip()
        return configured
    return ""


def resolve_client_id(
    explicit_client_id: str | None,
    *,
    local_env_path: Path = LOCAL_ENV_PATH,
) -> str:
    configured = (
        explicit_client_id
        or os.environ.get("JAMENDO_CLIENT_ID", "")
        or read_local_client_id(local_env_path)
    ).strip()
    if configured:
        return configured
    raise ImporterError(
        "Jamendo requires a client ID. Its published testing ID is currently "
        "suspended, so create a read-only developer app and set "
        "JAMENDO_CLIENT_ID or add it to analyser/.env.local."
    )


def assess_licence(licence_url: str) -> dict[str, Any]:
    normalised = licence_url.strip().lower()
    if "creativecommons.org/publicdomain/zero/" in normalised:
        return {
            "code": "CC0",
            "version": None,
            "commercial_allowed": True,
            "derivatives_allowed": True,
            "share_alike": False,
            "default_allowed": True,
        }

    match = CC_LICENCE_RE.search(normalised)
    if not match:
        return {
            "code": "UNKNOWN",
            "version": None,
            "commercial_allowed": False,
            "derivatives_allowed": False,
            "share_alike": False,
            "default_allowed": False,
        }

    licence_code = match.group("code").upper()
    components = set(licence_code.lower().split("-"))
    noncommercial = "nc" in components
    no_derivatives = "nd" in components
    share_alike = "sa" in components
    return {
        "code": f"CC {licence_code}",
        "version": match.group("version"),
        "commercial_allowed": not noncommercial,
        "derivatives_allowed": not no_derivatives,
        "share_alike": share_alike,
        # The default is deliberately narrow. Share-alike fixtures need an
        # explicit choice because synchronised visual use may add obligations.
        "default_allowed": not noncommercial and not no_derivatives and not share_alike,
    }


def build_tracks_url(
    *,
    client_id: str,
    track_id: str | None = None,
    search: str | None = None,
    limit: int = 10,
) -> str:
    parameters: dict[str, str | int] = {
        "client_id": client_id,
        "format": "json",
        "limit": limit,
        "include": "licenses musicinfo",
        "audioformat": "mp32",
        "audiodlformat": "mp32",
    }
    if track_id is not None:
        parameters["id"] = track_id
    if search is not None:
        parameters["search"] = search
        parameters["groupby"] = "artist_id"
    return f"{JAMENDO_TRACKS_URL}?{urllib.parse.urlencode(parameters)}"


def fetch_json(
    url: str,
    *,
    opener: UrlOpener = urllib.request.urlopen,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with opener(request, timeout=timeout_seconds) as response:
            payload = response.read(MAX_API_RESPONSE_BYTES + 1)
    except (OSError, urllib.error.URLError) as error:
        raise ImporterError(f"Could not reach the Jamendo API: {error}") from error

    if len(payload) > MAX_API_RESPONSE_BYTES:
        raise ImporterError("Jamendo API response exceeded the 2 MB safety limit.")
    try:
        decoded = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ImporterError("Jamendo API returned invalid JSON.") from error
    if not isinstance(decoded, dict):
        raise ImporterError("Jamendo API returned an unexpected response.")

    headers = decoded.get("headers")
    if not isinstance(headers, dict) or headers.get("status") != "success":
        message = headers.get("error_message") if isinstance(headers, dict) else None
        raise ImporterError(str(message or "Jamendo API request failed."))
    return decoded


def normalise_track(raw: dict[str, Any]) -> dict[str, Any]:
    track_id = str(raw.get("id", "")).strip()
    if not track_id.isdigit():
        raise ImporterError("Jamendo returned a track without a numeric ID.")
    title = str(raw.get("name", "")).strip()
    artist = str(raw.get("artist_name", "")).strip()
    if not title or not artist:
        raise ImporterError("Jamendo returned a track without attribution metadata.")
    try:
        duration_seconds = int(raw.get("duration") or 0)
    except (TypeError, ValueError) as error:
        raise ImporterError("Jamendo returned an invalid track duration.") from error
    if duration_seconds <= 0:
        raise ImporterError("Jamendo returned a non-positive track duration.")

    music_info = raw.get("musicinfo")
    tags = music_info.get("tags") if isinstance(music_info, dict) else {}
    if not isinstance(tags, dict):
        tags = {}

    licence_url = str(raw.get("license_ccurl", "")).strip()
    return {
        "track_id": track_id,
        "title": title,
        "artist": artist,
        "album": str(raw.get("album_name", "")).strip() or None,
        "duration_seconds": duration_seconds,
        "licence_url": licence_url,
        "licence": assess_licence(licence_url),
        "source_url": str(raw.get("shareurl", "")).strip(),
        "stream_url": str(raw.get("audio", "")).strip(),
        "download_url": str(raw.get("audiodownload", "")).strip(),
        "download_allowed": raw.get("audiodownload_allowed") is True,
        "content_id_free": raw.get("content_id_free") is True,
        "tags": {
            "genres": list(tags.get("genres") or []),
            "instruments": list(tags.get("instruments") or []),
            "moods": list(tags.get("vartags") or []),
        },
    }


def list_tracks(
    response: dict[str, Any],
    *,
    skip_invalid: bool = False,
) -> list[dict[str, Any]]:
    results = response.get("results")
    if not isinstance(results, list):
        raise ImporterError("Jamendo API response did not contain a track list.")

    tracks = []
    for raw in results:
        if not isinstance(raw, dict):
            if skip_invalid:
                continue
            raise ImporterError("Jamendo returned an invalid track record.")
        try:
            tracks.append(normalise_track(raw))
        except ImporterError:
            if not skip_invalid:
                raise
    return tracks


def track_is_importable(
    track: dict[str, Any],
    *,
    allow_restricted_licence: bool,
) -> bool:
    trusted_audio_url = False
    for raw_url in (track["stream_url"], track["download_url"]):
        audio_url = urllib.parse.urlparse(raw_url)
        if (
            audio_url.scheme == "https"
            and audio_url.hostname
            and (
                audio_url.hostname == "jamendo.com"
                or audio_url.hostname.endswith(".jamendo.com")
            )
        ):
            trusted_audio_url = True
            break
    return bool(
        track["download_allowed"]
        and trusted_audio_url
        and (
            track["licence"]["default_allowed"]
            or allow_restricted_licence
        )
    )


def looks_like_mp3(prefix: bytes) -> bool:
    if prefix.startswith(b"ID3"):
        return True
    return len(prefix) >= 2 and prefix[0] == 0xFF and (prefix[1] & 0xE0) == 0xE0


def download_audio(
    url: str,
    destination: Path,
    *,
    replace: bool = False,
    opener: UrlOpener = urllib.request.urlopen,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    maximum_bytes: int = MAX_AUDIO_BYTES,
) -> dict[str, Any]:
    if destination.exists() and not replace:
        raise ImporterError(
            f"Audio fixture already exists: {destination}. Use --replace explicitly."
        )

    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    temporary_path: Path | None = None
    try:
        with opener(request, timeout=timeout_seconds) as response:
            content_type = str(response.headers.get("Content-Type", "")).split(";", 1)[0]
            content_length = response.headers.get("Content-Length")
            if content_length:
                try:
                    declared_size = int(content_length)
                except ValueError as error:
                    raise ImporterError("Jamendo returned an invalid Content-Length.") from error
                if declared_size > maximum_bytes:
                    raise ImporterError("Jamendo audio exceeds the 50 MB fixture limit.")
            if content_type and not (
                content_type.startswith("audio/")
                or content_type == "application/octet-stream"
            ):
                raise ImporterError(
                    f"Jamendo returned an unexpected content type: {content_type}."
                )

            digest = hashlib.sha256()
            byte_count = 0
            prefix = b""
            with tempfile.NamedTemporaryFile(
                mode="wb",
                prefix=f".{destination.stem}-",
                suffix=".tmp",
                dir=destination.parent,
                delete=False,
            ) as temporary:
                temporary_path = Path(temporary.name)
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    byte_count += len(chunk)
                    if byte_count > maximum_bytes:
                        raise ImporterError("Jamendo audio exceeds the 50 MB fixture limit.")
                    if len(prefix) < 3:
                        prefix += chunk[: 3 - len(prefix)]
                    digest.update(chunk)
                    temporary.write(chunk)

        if byte_count == 0:
            raise ImporterError("Jamendo returned an empty audio file.")
        if not looks_like_mp3(prefix):
            raise ImporterError("Jamendo download did not contain MP3 audio.")
        os.replace(temporary_path, destination)
        temporary_path = None
        return {
            "sha256": digest.hexdigest(),
            "size_bytes": byte_count,
            "content_type": content_type or "audio/mpeg",
        }
    except ImporterError:
        raise
    except (OSError, urllib.error.URLError) as error:
        raise ImporterError(f"Could not download Jamendo audio: {error}") from error
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def load_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {
            "manifest_version": 1,
            "provider": "jamendo",
            "fixtures": [],
        }
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ImporterError(f"Fixture manifest is invalid JSON: {path}") from error
    if (
        not isinstance(manifest, dict)
        or manifest.get("manifest_version") != 1
        or manifest.get("provider") != "jamendo"
        or not isinstance(manifest.get("fixtures"), list)
    ):
        raise ImporterError(f"Fixture manifest has an unsupported schema: {path}")
    return manifest


def write_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(f"{path.suffix}.tmp")
    temporary_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary_path, path)


def upsert_fixture(
    manifest: dict[str, Any],
    fixture: dict[str, Any],
) -> dict[str, Any]:
    existing = [
        item
        for item in manifest["fixtures"]
        if str(item.get("track_id")) != fixture["track_id"]
    ]
    existing.append(fixture)
    existing.sort(key=lambda item: int(item["track_id"]))
    return {
        "manifest_version": 1,
        "provider": "jamendo",
        "fixtures": existing,
    }


def print_track(track: dict[str, Any]) -> None:
    licence = track["licence"]
    restrictions = []
    if not licence["commercial_allowed"]:
        restrictions.append("NC")
    if not licence["derivatives_allowed"]:
        restrictions.append("ND")
    if licence["share_alike"]:
        restrictions.append("SA")
    if not track["download_allowed"] or not track["download_url"]:
        restrictions.append("NO-DOWNLOAD")
    suffix = f" [{', '.join(restrictions)}]" if restrictions else ""
    print(
        f"{track['track_id']:>9}  {track['duration_seconds']:>4}s  "
        f"{licence['code']} {licence['version'] or ''}{suffix}  "
        f"{track['title']} - {track['artist']}"
    )


def run_search(args: argparse.Namespace, client_id: str) -> None:
    request_limit = min(max(args.limit * 5, 20), 200)
    response = fetch_json(
        build_tracks_url(
            client_id=client_id,
            search=args.query,
            limit=request_limit,
        )
    )
    candidates = list_tracks(response, skip_invalid=True)
    matches = [
        track
        for track in candidates
        if track_is_importable(
            track,
            allow_restricted_licence=args.allow_restricted_licence,
        )
    ][: args.limit]
    for track in matches:
        print_track(track)
    if not matches:
        raise ImporterError(
            "No importable tracks matched. Try another query or "
            "--allow-restricted-licence for non-commercial research."
        )


def run_import(args: argparse.Namespace, client_id: str) -> None:
    response = fetch_json(
        build_tracks_url(client_id=client_id, track_id=args.track_id, limit=1)
    )
    tracks = list_tracks(response)
    if not tracks:
        raise ImporterError(f"Jamendo track was not found: {args.track_id}")
    track = tracks[0]
    if track["track_id"] != args.track_id:
        raise ImporterError("Jamendo returned a different track than requested.")
    if not track_is_importable(
        track,
        allow_restricted_licence=args.allow_restricted_licence,
    ):
        print_track(track)
        raise ImporterError(
            "Track is not downloadable under the default licence policy. "
            "For non-commercial research, review the licence and pass "
            "--allow-restricted-licence explicitly."
        )

    audio_path = args.audio_dir.resolve() / f"jamendo_{track['track_id']}.mp3"
    try:
        relative_audio_path = audio_path.relative_to(REPOSITORY_ROOT)
    except ValueError as error:
        raise ImporterError(
            "Audio fixture destination must remain inside the repository."
        ) from error

    if audio_path.exists() and not args.replace:
        raise ImporterError(
            f"Audio fixture already exists: {audio_path}. Use --replace explicitly."
        )

    backup_path: Path | None = None
    if audio_path.exists() and args.replace:
        with tempfile.NamedTemporaryFile(
            prefix=f".{audio_path.stem}-",
            suffix=".backup",
            dir=audio_path.parent,
            delete=False,
        ) as backup:
            backup_path = Path(backup.name)
        backup_path.unlink()
        os.replace(audio_path, backup_path)

    try:
        download = download_audio(
            track["stream_url"] or track["download_url"],
            audio_path,
            replace=False,
        )

        licence = track["licence"]
        fixture = {
            "track_id": track["track_id"],
            "title": track["title"],
            "artist": track["artist"],
            "album": track["album"],
            "duration_seconds": track["duration_seconds"],
            "licence_code": licence["code"],
            "licence_version": licence["version"],
            "licence_url": track["licence_url"],
            "source_url": track["source_url"],
            "attribution": f"{track['title']} by {track['artist']}",
            "content_id_free": track["content_id_free"],
            "tags": track["tags"],
            "audio_path": relative_audio_path.as_posix(),
            "sha256": download["sha256"],
            "size_bytes": download["size_bytes"],
            "content_type": download["content_type"],
            "imported_at": datetime.now(timezone.utc).isoformat(),
            "evaluation_status": "candidate",
        }

        manifest = upsert_fixture(load_manifest(args.manifest), fixture)
        write_manifest(args.manifest, manifest)
    except Exception:
        audio_path.unlink(missing_ok=True)
        if backup_path is not None:
            os.replace(backup_path, audio_path)
            backup_path = None
        raise
    finally:
        if backup_path is not None:
            backup_path.unlink(missing_ok=True)

    print_track(track)
    print(f"Audio: {audio_path}")
    print(f"SHA-256: {download['sha256']}")
    print(f"Manifest: {args.manifest.resolve()}")
    print("Status: candidate, add human annotations before promoting it to CI.")


def positive_limit(value: str) -> int:
    parsed = int(value)
    if parsed < 1 or parsed > 50:
        raise argparse.ArgumentTypeError("limit must be between 1 and 50")
    return parsed


def numeric_track_id(value: str) -> str:
    if not value.isdigit():
        raise argparse.ArgumentTypeError("track ID must contain digits only")
    return value


def add_common_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--client-id",
        help=(
            "Jamendo client ID, otherwise read from JAMENDO_CLIENT_ID or "
            "analyser/.env.local"
        ),
    )
    parser.add_argument(
        "--allow-restricted-licence",
        action="store_true",
        help="Allow NC, ND, SA, or unknown licences after manual review",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import fixed, licensed Jamendo audio for analyser evaluation"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    search_parser = subparsers.add_parser(
        "search",
        help="Search downloadable tracks without writing files",
    )
    add_common_arguments(search_parser)
    search_parser.add_argument("query")
    search_parser.add_argument("--limit", type=positive_limit, default=10)

    import_parser = subparsers.add_parser(
        "import",
        help="Download one track and record its immutable fixture metadata",
    )
    add_common_arguments(import_parser)
    import_parser.add_argument("track_id", type=numeric_track_id)
    import_parser.add_argument("--audio-dir", type=Path, default=DEFAULT_AUDIO_DIR)
    import_parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    import_parser.add_argument(
        "--replace",
        action="store_true",
        help="Explicitly replace an existing fixture with the same track ID",
    )
    return parser.parse_args()


def main() -> None:
    reconfigure_stdout = getattr(sys.stdout, "reconfigure", None)
    if callable(reconfigure_stdout):
        reconfigure_stdout(encoding="utf-8", errors="replace")

    args = parse_args()
    try:
        client_id = resolve_client_id(args.client_id)
        if args.command == "search":
            run_search(args, client_id)
        else:
            run_import(args, client_id)
    except ImporterError as error:
        raise SystemExit(f"error: {error}") from error


if __name__ == "__main__":
    main()
