-- Explicit submission, evidence and review capabilities; internal triggers remain inaccessible.
revoke all on public.imports from public, anon, authenticated, service_role;
grant all on public.imports to service_role;
grant select, insert, update, delete on public.imports to authenticated;
revoke all on public.import_lines from public, anon, authenticated, service_role;
grant all on public.import_lines to service_role;
grant select, insert, update, delete on public.import_lines to authenticated;
revoke all on public.video_analyses from public, anon, authenticated, service_role;
grant all on public.video_analyses to service_role;
grant select, insert, update, delete on public.video_analyses to authenticated;
revoke all on public.design_candidates from public, anon, authenticated, service_role;
grant all on public.design_candidates to service_role;
grant select, insert, update, delete on public.design_candidates to authenticated;
revoke all on public.reviews from public, anon, authenticated, service_role;
grant all on public.reviews to service_role;
grant select, insert on public.reviews to authenticated;
revoke all on function public.accept_design_candidate(uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function private.accept_design_candidate(uuid, text, text, text), public.accept_design_candidate(uuid, text, text, text) to authenticated, service_role;
