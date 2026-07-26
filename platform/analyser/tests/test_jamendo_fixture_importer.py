import hashlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ANALYSER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ANALYSER_DIR))

from jamendo_fixture_importer import (  # noqa: E402
    ImporterError,
    assess_licence,
    download_audio,
    list_tracks,
    normalise_track,
    resolve_client_id,
    track_is_importable,
    upsert_fixture,
)


class FakeResponse:
    def __init__(self, payload, *, content_type="audio/mpeg", content_length=None):
        self.stream = io.BytesIO(payload)
        self.headers = {
            "Content-Type": content_type,
            "Content-Length": str(content_length if content_length is not None else len(payload)),
        }

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self, size=-1):
        return self.stream.read(size)


def fake_track(**overrides):
    track = {
        "id": "123",
        "name": "Fixture Song",
        "artist_name": "Fixture Artist",
        "album_name": "Fixture Album",
        "duration": 180,
        "license_ccurl": "https://creativecommons.org/licenses/by/4.0/",
        "shareurl": "https://www.jamendo.com/track/123",
        "audio": "https://prod-1.storage.jamendo.com/fixture-stream.mp3",
        "audiodownload": "https://prod-1.storage.jamendo.com/fixture.mp3",
        "audiodownload_allowed": True,
        "content_id_free": True,
        "musicinfo": {
            "tags": {
                "genres": ["electronic"],
                "instruments": ["synthesizer"],
                "vartags": ["energetic"],
            }
        },
    }
    track.update(overrides)
    return track


class JamendoFixtureImporterTests(unittest.TestCase):
    def test_client_id_is_required_because_the_public_test_app_is_suspended(self):
        with tempfile.TemporaryDirectory() as directory:
            missing_env = Path(directory) / ".env.local"
            with patch.dict("os.environ", {}, clear=True):
                with self.assertRaisesRegex(ImporterError, "currently suspended"):
                    resolve_client_id(None, local_env_path=missing_env)

        self.assertEqual(resolve_client_id("fixture-client"), "fixture-client")

    def test_client_id_can_be_read_from_gitignored_local_env(self):
        with tempfile.TemporaryDirectory() as directory:
            local_env = Path(directory) / ".env.local"
            local_env.write_text(
                "# Local analyser settings\n"
                "JAMENDO_CLIENT_ID='fixture-client'\n",
                encoding="utf-8",
            )
            with patch.dict("os.environ", {}, clear=True):
                self.assertEqual(
                    resolve_client_id(None, local_env_path=local_env),
                    "fixture-client",
                )

    def test_default_policy_accepts_cc_by(self):
        licence = assess_licence(
            "https://creativecommons.org/licenses/by/4.0/"
        )

        self.assertEqual(licence["code"], "CC BY")
        self.assertTrue(licence["default_allowed"])

    def test_default_policy_rejects_nc_nd_and_share_alike(self):
        for code in ("by-nc", "by-nd", "by-sa"):
            with self.subTest(code=code):
                licence = assess_licence(
                    f"https://creativecommons.org/licenses/{code}/4.0/"
                )
                self.assertFalse(licence["default_allowed"])

    def test_track_requires_permission_url_and_acceptable_licence(self):
        track = normalise_track(fake_track())
        blocked_download = normalise_track(
            fake_track(audiodownload_allowed=False, audiodownload="")
        )
        restricted = normalise_track(
            fake_track(
                license_ccurl=(
                    "https://creativecommons.org/licenses/by-nc-nd/4.0/"
                )
            )
        )
        untrusted_download = normalise_track(
            fake_track(
                audio="https://example.test/fixture-stream.mp3",
                audiodownload="https://example.test/fixture.mp3",
            )
        )

        self.assertTrue(
            track_is_importable(track, allow_restricted_licence=False)
        )
        self.assertFalse(
            track_is_importable(blocked_download, allow_restricted_licence=True)
        )
        self.assertFalse(
            track_is_importable(restricted, allow_restricted_licence=False)
        )
        self.assertTrue(
            track_is_importable(restricted, allow_restricted_licence=True)
        )
        self.assertFalse(
            track_is_importable(untrusted_download, allow_restricted_licence=True)
        )

    def test_search_can_skip_an_invalid_track_without_weakening_imports(self):
        response = {
            "results": [
                fake_track(id="1", duration=0),
                fake_track(id="2"),
            ]
        }

        tracks = list_tracks(response, skip_invalid=True)

        self.assertEqual([track["track_id"] for track in tracks], ["2"])
        with self.assertRaisesRegex(ImporterError, "non-positive"):
            list_tracks(response)

    def test_download_streams_mp3_and_returns_immutable_metadata(self):
        payload = b"ID3" + b"fixture-audio" * 20

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "fixture.mp3"
            result = download_audio(
                "https://example.test/fixture.mp3",
                destination,
                opener=lambda request, timeout: FakeResponse(payload),
            )

            self.assertEqual(destination.read_bytes(), payload)
            self.assertEqual(result["size_bytes"], len(payload))
            self.assertEqual(
                result["sha256"],
                hashlib.sha256(payload).hexdigest(),
            )

    def test_oversized_download_is_rejected_without_partial_file(self):
        payload = b"ID3" + b"x" * 20

        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "fixture.mp3"
            with self.assertRaisesRegex(ImporterError, "50 MB"):
                download_audio(
                    "https://example.test/fixture.mp3",
                    destination,
                    maximum_bytes=10,
                    opener=lambda request, timeout: FakeResponse(payload),
                )

            self.assertFalse(destination.exists())
            self.assertEqual(list(Path(directory).glob("*.tmp")), [])

    def test_manifest_upsert_is_sorted_and_replaces_by_track_id(self):
        manifest = {
            "manifest_version": 1,
            "provider": "jamendo",
            "fixtures": [
                {"track_id": "20", "title": "Old"},
                {"track_id": "5", "title": "First"},
            ],
        }

        updated = upsert_fixture(
            manifest,
            {"track_id": "20", "title": "Replacement"},
        )

        self.assertEqual(
            [fixture["track_id"] for fixture in updated["fixtures"]],
            ["5", "20"],
        )
        self.assertEqual(updated["fixtures"][1]["title"], "Replacement")
        json.dumps(updated)


if __name__ == "__main__":
    unittest.main()
