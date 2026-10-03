-- Invitation acceptance is available only to authenticated callers; identity is checked inside.
revoke all on function private.accept_invitation(text), public.accept_invitation(text) from public, anon;
grant execute on function private.accept_invitation(text), public.accept_invitation(text) to authenticated;
