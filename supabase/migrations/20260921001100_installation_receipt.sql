-- Records one-time content installation independently of later catalogue edits.
create table private.installation (
  id boolean primary key default true check (id),
  snapshot_sha256 text not null check (snapshot_sha256 ~ '^[a-f0-9]{64}$'),
  media_ready boolean not null default false,
  installed_at timestamptz not null default now()
);

revoke all on private.installation from public, anon, authenticated, service_role;
