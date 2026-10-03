-- Scheduled SQL entry points and least-privilege execution.
select no_plan();
select tests.create_operations_fixture();
create temporary table expected_jobs(name text,schedule text,command text);
insert into expected_jobs values
  ('events-partitions','0 2 * * *','select private.maintain_event_partitions();'),
  ('events-hourly-rollup','*/5 * * * *','select private.rollup_events(now() - interval ''10 minutes'',now());'),
  ('events-daily-rollup','0 3 * * *','select private.rollup_events(date_trunc(''day'',now(),''UTC'') - interval ''1 day'',date_trunc(''day'',now(),''UTC''));'),
  ('lists-expire','10 3 * * *','select private.expire_lists();'),
  ('credits-release','20 3 * * *','select private.release_expired_credit_reservations();'),
  ('anonymous-users-purge','30 3 * * *','select private.purge_inactive_anonymous_users();'),
  ('shows-stock-refresh','0 * * * *','select private.recalculate_show_stock();'),
  ('invitations-expire','5 * * * *','select private.expire_invitations();');
select ok(current_setting('cron.timezone') in ('GMT','UTC'),'scheduler uses a UTC clock');
select is((select count(*) from cron.job),8::bigint,'only the eight SQL maintenance jobs are installed');
select is(job.schedule,expected.schedule,expected.name || ' schedule')
  from expected_jobs as expected join cron.job as job on job.jobname = expected.name;
select is(job.command,expected.command,expected.name || ' command')
  from expected_jobs as expected join cron.job as job on job.jobname = expected.name;
select ok(job.active and job.username = 'postgres' and job.database = current_database(),expected.name || ' runs locally as postgres')
  from expected_jobs as expected join cron.job as job on job.jobname = expected.name;
select lives_ok(job.command,job.jobname || ' scheduled command executes') from cron.job as job;
select is(has_function_privilege(api.role_name,procedure.signature,'execute'),
  api.role_name = 'service_role' and procedure.signature in ('private.maintain_event_partitions(text)',
    'private.rollup_events(timestamp with time zone,timestamp with time zone)','private.release_expired_credit_reservations()'),
  api.role_name || ' ACL for ' || procedure.signature)
  from (values ('anon'),('authenticated'),('service_role')) as api(role_name)
  cross join (values ('private.recalculate_show_stock()'),('private.expire_lists()'),('private.expire_invitations()'),
    ('private.purge_inactive_anonymous_users()'),('private.profile_has_retained_references(uuid)'),
    ('private.maintain_event_partitions(text)'),('private.rollup_events(timestamp with time zone,timestamp with time zone)'),
    ('private.release_expired_credit_reservations()')) as procedure(signature);

-- A five-minute run rebuilding today must retain earlier events in the same bucket.
select lives_ok((select command from cron.job where jobname = 'events-hourly-rollup'),'scheduled hourly rollup executes');
select is((select sum(value) from public.metrics_daily where metric = 'scans'),3::numeric,'rolling lookback preserves all same-day scans');
select lives_ok((select command from cron.job where jobname = 'events-hourly-rollup'),'scheduled hourly rollup reruns');
select is((select sum(value) from public.metrics_daily where metric = 'scans'),3::numeric,'rerun does not double-count scans');
select finish();
