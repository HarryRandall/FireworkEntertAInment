-- PostgreSQL executes named jobs as postgres in UTC. Re-scheduling a name replaces it.
-- Only postgres can call maintenance functions; clients cannot delete accounts or reconcile facts.
revoke all on function private.recalculate_show_stock(),private.expire_lists(),private.expire_invitations(),
  private.profile_has_retained_references(uuid),private.purge_inactive_anonymous_users()
  from public,anon,authenticated,service_role;

-- Partition retention and precreation follow the installed pg_partman configuration.
select cron.schedule('events-partitions','0 2 * * *','select private.maintain_event_partitions();');
-- The ten-minute lookback covers two five-minute runs; the shared function rebuilds complete UTC buckets.
select cron.schedule('events-hourly-rollup','*/5 * * * *',
  $$select private.rollup_events(now() - interval '10 minutes',now());$$);
-- Reconcile yesterday's complete UTC day at the plan's 03:00 daily rollup time.
select cron.schedule('events-daily-rollup','0 3 * * *',
  $$select private.rollup_events(date_trunc('day',now(),'UTC') - interval '1 day',date_trunc('day',now(),'UTC'));$$);
-- Daily lifecycle cleanup is ordered after the rollup; these times are operational choices in UTC.
select cron.schedule('lists-expire','10 3 * * *','select private.expire_lists();');
select cron.schedule('credits-release','20 3 * * *','select private.release_expired_credit_reservations();');
select cron.schedule('anonymous-users-purge','30 3 * * *','select private.purge_inactive_anonymous_users();');
-- Reconcile stock on the hour and invitations five minutes later to stagger maintenance.
select cron.schedule('shows-stock-refresh','0 * * * *','select private.recalculate_show_stock();');
select cron.schedule('invitations-expire','5 * * * *','select private.expire_invitations();');
