-- The private helper already has the authenticated policy grant.
revoke all on function public.current_staff_role() from public, anon;
grant execute on function public.current_staff_role() to authenticated;
