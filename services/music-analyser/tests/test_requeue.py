"""Local transaction checks for soundtracks, duplicate jobs and pinned histories."""

import json
import os
import platform
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audio_download import AudioDownloadError  # noqa: E402
from requeue_saved_music import LOCAL_DATABASE, requeue_sql  # noqa: E402
from beat_tracking import NEURAL_ALGORITHM  # noqa: E402


class RequeueTests(unittest.TestCase):
    def test_manifest_validates_uuid_and_allowlisted_url(self):
        with self.assertRaises(ValueError):
            requeue_sql(
                [{"track_id": "bad", "audio_url": "https://example.test/a"}],
                NEURAL_ALGORITHM,
            )
        with self.assertRaises(AudioDownloadError):
            requeue_sql(
                [{"track_id": str(uuid4()), "audio_url": "https://untrusted.test/a"}],
                NEURAL_ALGORITHM,
            )

    @unittest.skipUnless(
        os.environ.get("SHOWCRAFTER_TEST_LOCAL_DATABASE") == "1",
        "Explicit local database acceptance only",
    )
    def test_atomic_requeue_preserves_pins_and_skips_active_or_upgraded_tracks(self):
        tracks = [str(uuid4()) for _ in range(4)]
        analyses = [str(uuid4()) for _ in tracks]
        fixture = json.loads(
            (Path(__file__).parent / "fixtures/analysis.json").read_text()
        )
        document = json.dumps(fixture).replace("'", "''")
        sql = "begin;\n"
        for index, (track, analysis) in enumerate(zip(tracks, analyses)):
            algorithm = NEURAL_ALGORITHM if index == 2 else "librosa-1.4.0"
            sql += f"""
insert into public.music_tracks(id,provider,provider_track_id,title,duration_ms,licence_code)
 values ('{track}','jamendo','{track}','Local soundtrack',10000,'CC0');
insert into public.music_analyses(id,track_id,algorithm,analysis,audio_sha256)
 values ('{analysis}','{track}','{algorithm}','{document}','{"a" * 64}');
"""
            if index != 3:
                show = str(uuid4())
                sql += f"""
insert into public.shows(id,organisation_id,name,origin,soundtrack_track_id)
 select '{show}',id,'Local requeue fixture','manual','{track}' from public.organisations limit 1;
insert into public.show_versions(show_id,organisation_id,number,cues,duration_ms,soundtrack_analysis_id)
 select saved.id,saved.organisation_id,1,template.cues,template.duration_ms,'{analysis}'
 from public.shows saved join lateral (select cues,duration_ms from public.show_versions
 where organisation_id=saved.organisation_id limit 1) template on true where saved.id='{show}';
"""
        sql += f'insert into public.jobs(kind,payload) values (\'music_analyse\',\'{{"track_id":"{tracks[1]}","audio_url":"https://audio.test/source"}}\');\n'
        payloads = [
            {"track_id": track, "audio_url": "https://audio.test/source?title=O'Reilly"}
            for track in tracks
        ]
        with patch.dict(os.environ, {"ANALYSER_ALLOWED_AUDIO_HOSTS": "audio.test"}):
            sql += requeue_sql(payloads, NEURAL_ALGORITHM)
        # SQL temp tables are per-operation; a repeat uses fresh names in the same rollback transaction.
        sql += "drop table music_queued; drop table music_sources;\n"
        with patch.dict(os.environ, {"ANALYSER_ALLOWED_AUDIO_HOSTS": "audio.test"}):
            sql += requeue_sql(payloads, NEURAL_ALGORITHM)
        sql += f"""
select jsonb_build_object(
 'old_not_current',(select not is_current from public.music_analyses where id='{analyses[0]}'),
 'active_unchanged',(select is_current from public.music_analyses where id='{analyses[1]}'),
 'upgraded_unchanged',(select is_current from public.music_analyses where id='{analyses[2]}'),
 'unused_unchanged',(select is_current from public.music_analyses where id='{analyses[3]}'),
 'pin_preserved',exists(select from public.show_versions where soundtrack_analysis_id='{analyses[0]}'),
 'jobs',(select count(*) from public.jobs where payload->>'track_id' in ('{tracks[0]}','{tracks[1]}','{tracks[2]}','{tracks[3]}')));
rollback;
"""
        psql = (
            "/opt/homebrew/opt/libpq/bin/psql"
            if platform.system() == "Darwin"
            else "psql"
        )
        result = subprocess.run(
            [psql, LOCAL_DATABASE, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
            input=sql,
            text=True,
            capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        objects = [
            json.loads(line)
            for line in result.stdout.splitlines()
            if line.startswith("{")
        ]
        self.assertEqual(objects[0]["queued"], 1)
        self.assertEqual(objects[1]["queued"], 0)
        self.assertEqual(
            objects[2],
            {
                "old_not_current": True,
                "active_unchanged": True,
                "upgraded_unchanged": True,
                "unused_unchanged": True,
                "pin_preserved": True,
                "jobs": 2,
            },
        )


if __name__ == "__main__":
    unittest.main()
