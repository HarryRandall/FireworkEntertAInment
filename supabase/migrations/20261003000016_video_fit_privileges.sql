-- Native-video calls and candidate writes are restricted to fenced trusted workers.
revoke all on function public.video_fit_step(uuid,text,smallint,text,jsonb),
  private.video_fit_step(uuid,text,smallint,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.video_fit_step(uuid,text,smallint,text,jsonb),
  private.video_fit_step(uuid,text,smallint,text,jsonb) to service_role;
