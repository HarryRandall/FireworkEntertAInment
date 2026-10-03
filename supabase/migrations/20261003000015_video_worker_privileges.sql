-- Measurement writes require a current trusted queue attempt, never a browser role.
revoke all on function public.save_video_measurement(uuid,text,smallint,text,text,jsonb,text),
  private.save_video_measurement(uuid,text,smallint,text,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.save_video_measurement(uuid,text,smallint,text,text,jsonb,text),
  private.save_video_measurement(uuid,text,smallint,text,text,jsonb,text) to service_role;
