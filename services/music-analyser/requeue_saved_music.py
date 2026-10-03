"""Atomically queue selected saved-show soundtracks against the fixed local database."""

import argparse
import json
import platform
import subprocess
from pathlib import Path
from uuid import UUID

from audio_download import validated_audio_host
from beat_tracking import DEFAULT_TRACKER, NEURAL_ALGORITHM, algorithm_for
from music_jobs import MusicPayload

# Exact rebuild database origin, deliberately not configurable through environment.
LOCAL_DATABASE = "postgresql://postgres:postgres@127.0.0.1:55422/postgres"
# Bound administrative lock waits and the local command's wall-clock duration in seconds.
LOCK_TIMEOUT_SECONDS = 5
COMMAND_TIMEOUT_SECONDS = 60


def requeue_sql(payloads: list[dict], algorithm: str) -> str:
    """Build one transactional operation for selected UUIDs and trusted provider URLs.

    Caller owns BEGIN/COMMIT or ROLLBACK. Queued tracks lose their current pointer,
    while immutable features and saved-show analysis UUIDs remain untouched. Active
    jobs are skipped, so an existing worker's attempt is never changed.
    """
    validated = []
    for payload in payloads:
        model = MusicPayload.model_validate(payload)
        validated_audio_host(str(model.audio_url))
        validated.append(
            {
                "track_id": str(UUID(str(model.track_id))),
                "audio_url": str(model.audio_url),
            }
        )
    # SQL string escaping keeps untrusted URL characters in data, never executable SQL.
    document = json.dumps(validated).replace("'", "''")
    target = algorithm.replace("'", "''")
    return f"""
set local lock_timeout = '{LOCK_TIMEOUT_SECONDS}s';
create temporary table music_sources on commit drop as
  select distinct track_id::uuid as track_id, audio_url
  from jsonb_to_recordset('{document}'::jsonb) as source(track_id text,audio_url text);
create unique index on music_sources(track_id);
-- Lock tracks in UUID order, matching the result installer's track lock boundary.
select track.id from public.music_tracks track join music_sources source on source.track_id=track.id
  order by track.id for update of track;
create temporary table music_queued on commit drop as
with candidates as (
  select source.* from music_sources source join public.music_tracks track on track.id=source.track_id
  where track.provider='jamendo'
    and exists (select from public.show_versions version join public.music_analyses pinned
      on pinned.id=version.soundtrack_analysis_id where pinned.track_id=track.id)
    and not exists (select from public.music_analyses current_analysis
      where current_analysis.track_id=track.id and current_analysis.is_current
        and current_analysis.algorithm='{target}')
), queued as (
  insert into public.jobs(kind,payload)
  select 'music_analyse',jsonb_build_object('track_id',track_id,'audio_url',audio_url) from candidates
  on conflict do nothing returning (payload->>'track_id')::uuid as track_id
) select * from queued;
update public.music_analyses analysis set is_current=false
  where analysis.is_current and analysis.track_id in (select track_id from music_queued);
select jsonb_build_object('selected', (select count(*) from music_sources),
  'queued', (select count(*) from music_queued));
"""


def main() -> None:
    """Dry-run by rollback unless --apply is supplied; refuse an unselected upgrade."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "manifest", type=Path, help="JSON array of track_id/audio_url objects"
    )
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if algorithm_for(DEFAULT_TRACKER) != NEURAL_ALGORITHM:
        raise ValueError("Default tracker has not been upgraded; requeue is disabled")
    payloads = json.loads(args.manifest.read_text())
    if not isinstance(payloads, list):
        raise ValueError("Track manifest must be an array")
    sql = "begin;\n" + requeue_sql(payloads, NEURAL_ALGORITHM)
    sql += "\ncommit;" if args.apply else "\nrollback;"
    psql = (
        "/opt/homebrew/opt/libpq/bin/psql" if platform.system() == "Darwin" else "psql"
    )
    subprocess.run(
        [psql, LOCAL_DATABASE, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
        input=sql,
        text=True,
        check=True,
        timeout=COMMAND_TIMEOUT_SECONDS,
    )


if __name__ == "__main__":
    main()
