-- Public input facts and service-only solver writes have distinct trust boundaries.
revoke all on function public.planner_context(uuid), private.planner_context(uuid) from public,anon,authenticated,service_role;
grant execute on function public.planner_context(uuid), private.planner_context(uuid) to anon,authenticated,service_role;
revoke all on function private.planner_sale_open(uuid) from public,anon,authenticated,service_role;
revoke all on function public.persist_planner_result(uuid,uuid,uuid,jsonb,text,text,jsonb,uuid),
  private.persist_planner_result(uuid,uuid,uuid,jsonb,text,text,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.persist_planner_result(uuid,uuid,uuid,jsonb,text,text,jsonb,uuid),
  private.persist_planner_result(uuid,uuid,uuid,jsonb,text,text,jsonb,uuid) to service_role;
