-- Only the authenticated server boundary may author edit operations and solved results.
revoke all on function public.persist_plan_edit(uuid,uuid,uuid,int,int,text,jsonb,jsonb,jsonb),
  private.persist_plan_edit(uuid,uuid,uuid,int,int,text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.persist_plan_edit(uuid,uuid,uuid,int,int,text,jsonb,jsonb,jsonb),
  private.persist_plan_edit(uuid,uuid,uuid,int,int,text,jsonb,jsonb,jsonb) to service_role;
