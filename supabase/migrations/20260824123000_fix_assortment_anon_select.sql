-- Fix: the combined "is_active OR current_user_has_permission(...)" select
-- policies from 20260824120000_add_assortments.sql fail outright for
-- anonymous kiosk requests. current_user_has_permission() only has EXECUTE
-- granted to `authenticated` and `postgres` (verified via
-- information_schema.routine_privileges), not `anon`, and Postgres does not
-- reliably short-circuit past that call just because `is_active = true`
-- already matched — the anon role hits a bare
-- "permission denied for function current_user_has_permission" instead of
-- the row simply passing. Role-scoping the two conditions into separate
-- policies means the admin-only policy is never even considered for an
-- anon-role query, so the function is never invoked for that role.
--
-- public.show_presets (20260709134609_admin_show_presets_publication.sql)
-- has the identical "published OR current_user_has_permission(...)" shape
-- and is also anon-selectable — it likely has the same live bug for
-- logged-out /library and /home visitors. Left alone here since it is
-- unrelated to the assortments work; flagging for separate follow-up.

drop policy if exists "assortments_select" on public.assortments;
create policy "assortments_select_public" on public.assortments
  for select to anon, authenticated
  using (is_active = true);
create policy "assortments_select_admin" on public.assortments
  for select to authenticated
  using (public.current_user_has_permission('admin.manage_assortments'));

drop policy if exists "assortment_items_select" on public.assortment_items;
create policy "assortment_items_select_public" on public.assortment_items
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.assortments a
      where a.id = assortment_id and a.is_active = true
    )
  );
create policy "assortment_items_select_admin" on public.assortment_items
  for select to authenticated
  using (public.current_user_has_permission('admin.manage_assortments'));
