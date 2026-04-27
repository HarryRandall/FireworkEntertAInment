-- Address Supabase advisors:
--   * function_search_path_mutable on set_updated_at
--   * anon/authenticated_security_definer_function_executable on handle_new_user
-- Lock down the search_path on both functions, and revoke EXECUTE from public/anon/authenticated
-- so handle_new_user can only be invoked by the on_auth_user_created trigger (postgres role).

alter function public.set_updated_at() set search_path = '';

revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter function public.handle_new_user() set search_path = '';
