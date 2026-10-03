-- Explicit domain capabilities after the default-revoked foundation privileges.
revoke all on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.uid(), private.is_anon(), private.staff_role()
  to anon, authenticated, service_role;
grant execute on function private.org_ids(text), private.can(uuid, text),
  private.store_access(uuid, uuid), private.can_store(uuid, uuid, text)
  to authenticated, service_role;
revoke all on public.markets from public, anon, authenticated, service_role;
grant all on public.markets to service_role;
grant select, insert, update, delete on public.markets to authenticated;
grant select on public.markets to anon;
revoke all on public.sale_periods from public, anon, authenticated, service_role;
grant all on public.sale_periods to service_role;
grant select, insert, update, delete on public.sale_periods to authenticated;
grant select on public.sale_periods to anon;
revoke all on public.safety_bands from public, anon, authenticated, service_role;
grant all on public.safety_bands to service_role;
grant select, insert, update, delete on public.safety_bands to authenticated;
grant select on public.safety_bands to anon;
revoke all on public.profiles from public, anon, authenticated, service_role;
grant all on public.profiles to service_role;
grant select on public.profiles to authenticated;
grant update (display_name, locale, market, last_seen_at) on public.profiles to authenticated;
revoke all on public.staff_roles from public, anon, authenticated, service_role;
grant all on public.staff_roles to service_role;
grant select, insert, update, delete on public.staff_roles to authenticated;
revoke all on public.organisations from public, anon, authenticated, service_role;
grant all on public.organisations to service_role;
grant select, insert, update on public.organisations to authenticated;
revoke all on public.organisation_markets from public, anon, authenticated, service_role;
grant all on public.organisation_markets to service_role;
grant select, insert, update, delete on public.organisation_markets to authenticated;
revoke all on public.stores from public, anon, authenticated, service_role;
grant all on public.stores to service_role;
grant select, insert, update on public.stores to authenticated;
revoke all on public.memberships from public, anon, authenticated, service_role;
grant all on public.memberships to service_role;
grant select, insert, update, delete on public.memberships to authenticated;
revoke all on public.invitations from public, anon, authenticated, service_role;
grant all on public.invitations to service_role;
grant select, insert, update on public.invitations to authenticated;
revoke all on public.branding from public, anon, authenticated, service_role;
grant all on public.branding to service_role;
grant select, insert, update, delete on public.branding to authenticated;
