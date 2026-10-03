-- Shopper reads are ownership fenced; only the server can import and author solves.
revoke all on function public.import_shopper_track(uuid,uuid,jsonb),private.import_shopper_track(uuid,uuid,jsonb),
  public.persist_plan_music(uuid,uuid,uuid,int,text,jsonb,jsonb,uuid,uuid,text),
  private.persist_plan_music(uuid,uuid,uuid,int,text,jsonb,jsonb,uuid,uuid,text),
  public.plan_soundtrack(uuid),private.plan_soundtrack(uuid),private.validate_plan_soundtrack()
  from public,anon,authenticated,service_role;
grant execute on function public.import_shopper_track(uuid,uuid,jsonb),private.import_shopper_track(uuid,uuid,jsonb),
  public.persist_plan_music(uuid,uuid,uuid,int,text,jsonb,jsonb,uuid,uuid,text),
  private.persist_plan_music(uuid,uuid,uuid,int,text,jsonb,jsonb,uuid,uuid,text) to service_role;
grant execute on function public.plan_soundtrack(uuid),private.plan_soundtrack(uuid) to authenticated;
revoke all on function public.show_soundtrack(uuid,uuid),private.show_soundtrack(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.show_soundtrack(uuid,uuid),private.show_soundtrack(uuid,uuid) to anon,authenticated;
revoke all on function public.music_track_analysis(uuid,uuid),private.music_track_analysis(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.music_track_analysis(uuid,uuid),private.music_track_analysis(uuid,uuid) to authenticated;
