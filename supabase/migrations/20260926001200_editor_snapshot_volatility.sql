begin;

-- JSON construction uses stable PostgreSQL functions, so the helper must not
-- promise the planner that its result is independent of session settings.
alter function private.firework_editor_snapshot(text, jsonb) stable;

commit;
