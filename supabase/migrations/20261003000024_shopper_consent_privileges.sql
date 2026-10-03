-- Caller-bound consent uses narrow execution grants, never identity-column update grants.
revoke all on function public.save_shopper_consent(uuid,boolean,boolean,text),private.save_shopper_consent(uuid,boolean,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.save_shopper_consent(uuid,boolean,boolean,text),private.save_shopper_consent(uuid,boolean,boolean,text) to authenticated;
