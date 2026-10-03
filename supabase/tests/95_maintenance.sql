-- Lifecycle expiry boundaries and rerun safety.
select no_plan();
select tests.create_operations_fixture();
-- valid_until is inclusive; redeemed lists remain a historical receipt.
update public.lists set valid_until = (now() at time zone 'Europe/London')::date - 1
  where id in ('a2000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000003');
update public.lists set valid_until = (now() at time zone 'Europe/London')::date
  where id = 'a2000000-0000-0000-0000-000000000002';
set local timezone = 'Pacific/Auckland';
select is(private.expire_lists(),1::bigint,'only yesterday open list expires using the store calendar');
select is((select status from public.lists where id = 'a2000000-0000-0000-0000-000000000002'),'open','today list remains valid');
select is((select status from public.lists where id = 'a2000000-0000-0000-0000-000000000003'),'redeemed','redeemed history preserved');
select is(private.expire_lists(),0::bigint,'list expiry is idempotent');
set local timezone = 'UTC';

insert into public.invitations(organisation_id,email,role,token_hash,expires_at,accepted_at,revoked_at) values
  ('10000000-0000-0000-0000-000000000001','expired@example.invalid','staff','expired',now(),null,null),
  ('10000000-0000-0000-0000-000000000001','future@example.invalid','staff','future',now()+interval '1 hour',null,null),
  ('10000000-0000-0000-0000-000000000001','accepted@example.invalid','staff','accepted',now()-interval '1 hour',now(),null),
  ('10000000-0000-0000-0000-000000000001','revoked@example.invalid','staff','revoked',now()-interval '1 hour',null,now()-interval '2 hours');
select is(private.expire_invitations(),1::bigint,'unaccepted invitation expires at the exact deadline');
select ok((select revoked_at is null from public.invitations where token_hash = 'future'),'future invitation preserved');
select ok((select revoked_at is null from public.invitations where token_hash = 'accepted'),'accepted invitation preserved');
select is((select revoked_at from public.invitations where token_hash = 'revoked'),now()-interval '2 hours','old revocation timestamp preserved');
select is(private.expire_invitations(),0::bigint,'invitation expiry is idempotent');

update public.credit_reservations set expires_at = now() where organisation_id = '10000000-0000-0000-0000-000000000001';
select is(private.release_expired_credit_reservations(),1::bigint,'scheduled credit release affects only expired holds');
select is(private.release_expired_credit_reservations(),0::bigint,'credit release rerun changes nothing');
select is((select count(*) from public.credit_ledger),2::bigint,'maintenance never reserves stock or spends credits');

select finish();
