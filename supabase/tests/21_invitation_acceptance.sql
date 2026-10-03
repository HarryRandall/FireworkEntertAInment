-- Acceptance exercises caller identity, token fencing and atomic membership writes.
select no_plan();
select tests.create_personas();
insert into public.markets (code, name, currency, locale, timezone, min_age, units, enabled)
values ('GB', 'United Kingdom', 'GBP', 'en-GB', 'Europe/London', 18, 'metric', true);
insert into public.organisations (id, name, slug, home_market, billing_currency)
values ('10000000-0000-0000-0000-000000000001', 'Invitation retailer', 'invitation-retailer', 'GB', 'GBP');
update auth.users set email = 'invite@showcrafter.test', email_confirmed_at = now()
where id = tests.get_supabase_uid('signed_in_shopper');
insert into public.stores (id, organisation_id, name, slug, market, timezone, licence)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Scoped store', 'scoped', 'GB', 'Europe/London', 'all_year');
insert into public.invitations (organisation_id, email, role, token_hash, expires_at, revoked_at)
select '10000000-0000-0000-0000-000000000001', 'INVITE@showcrafter.test', 'manager',
encode(extensions.digest(token, 'sha256'), 'hex'),
case when token = 'expired' then now() - interval '1 second' else now() + interval '1 day' end,
case when token = 'revoked' then now() else null end
from unnest(array['valid', 'expired', 'revoked', 'unverified', 'suspended', 'atomic', 'existing']) as token;
update public.invitations set store_ids = array['20000000-0000-0000-0000-000000000001']::uuid[]
where token_hash = encode(extensions.digest('valid', 'sha256'), 'hex');
-- Check the grant rather than calling as anon: a denied direct call can crash Postgres
-- through the supautils role-hints bug (supabase/supautils issue 214).
select ok(not has_function_privilege('anon', 'public.accept_invitation(text)', 'EXECUTE'), 'public caller cannot execute acceptance');
select tests.act_as('anonymous_shopper');
select throws_ok($$select public.accept_invitation('valid')$$, '42501', 'A verified email account is required', 'anonymous account cannot accept');
reset role;
select tests.act_as('organisation_owner');
select throws_ok($$select public.accept_invitation('valid')$$, '42501', null, 'wrong email cannot accept');
reset role;
select tests.act_as('signed_in_shopper');
select throws_ok($$select public.accept_invitation('missing')$$, '22023', 'Invitation is invalid', 'unknown token is refused');
select throws_ok($$select public.accept_invitation('')$$, '22023', 'Invitation is invalid', 'empty token is refused');
select throws_ok($$select public.accept_invitation('expired')$$, '42501', null, 'expired token is refused');
select throws_ok($$select public.accept_invitation('revoked')$$, '42501', null, 'revoked token is refused');
reset role;
select is((select count(*) from public.memberships), 0::bigint, 'failed acceptance writes no memberships');
select is((select count(*) from public.invitations where accepted_at is not null), 0::bigint, 'failed acceptance marks no invitations');
update auth.users set email_confirmed_at = null where id = tests.get_supabase_uid('signed_in_shopper');
select tests.act_as('signed_in_shopper');
select throws_ok($$select public.accept_invitation('unverified')$$, '42501', null, 'unverified email is refused');
reset role;
update auth.users set email_confirmed_at = now() where id = tests.get_supabase_uid('signed_in_shopper');
update public.profiles set status = 'suspended' where id = tests.get_supabase_uid('signed_in_shopper');
select tests.act_as('signed_in_shopper');
select throws_ok($$select public.accept_invitation('suspended')$$, '42501', null, 'suspended account is refused');
reset role;
update public.profiles set status = 'active' where id = tests.get_supabase_uid('signed_in_shopper');
select tests.act_as('signed_in_shopper');
select is(public.accept_invitation('valid'), '10000000-0000-0000-0000-000000000001'::uuid, 'verified email accepts case-insensitively');
select is(public.accept_invitation('valid'), '10000000-0000-0000-0000-000000000001'::uuid, 'same caller can repeat acceptance');
reset role;
select is((select count(*) from public.memberships), 1::bigint, 'repeat creates only one membership');
select is((select role from public.memberships where profile_id = tests.get_supabase_uid('signed_in_shopper')), 'manager', 'invitation grants its role');
select is((select accepted_by from public.invitations where accepted_at is not null), tests.get_supabase_uid('signed_in_shopper'), 'acceptance records the actual user');
select is((select store_ids from public.memberships where profile_id = tests.get_supabase_uid('signed_in_shopper')), array['20000000-0000-0000-0000-000000000001']::uuid[], 'membership retains invitation store scope');
-- A failure while marking acceptance rolls back the preceding membership insert.
create function tests.reject_acceptance() returns trigger language plpgsql as $$
begin
  if new.token_hash = encode(extensions.digest('atomic', 'sha256'), 'hex') then
    raise exception 'Test write failure' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger reject_acceptance before update on public.invitations for each row execute function tests.reject_acceptance();
delete from public.memberships where profile_id = tests.get_supabase_uid('signed_in_shopper');
select tests.act_as('signed_in_shopper');
select throws_ok($$select public.accept_invitation('atomic')$$, '23514', 'Test write failure', 'unexpected write failure remains visible');
reset role;
select is((select count(*) from public.memberships), 0::bigint, 'failed second write rolls back membership insertion');
select is((select accepted_at from public.invitations where token_hash = encode(extensions.digest('atomic', 'sha256'), 'hex')), null::timestamptz, 'failed second write leaves invitation unaccepted');
insert into public.memberships (organisation_id, profile_id, role)
values ('10000000-0000-0000-0000-000000000001', tests.get_supabase_uid('signed_in_shopper'), 'owner');
select tests.act_as('signed_in_shopper');
select lives_ok($$select public.accept_invitation('existing')$$, 'existing member may accept without rights replacement');
reset role;
select is((select role from public.memberships where profile_id = tests.get_supabase_uid('signed_in_shopper')), 'owner', 'acceptance does not downgrade an existing member');
update auth.users set email = 'changed@showcrafter.test' where id = tests.get_supabase_uid('signed_in_shopper');
select tests.act_as('signed_in_shopper');
select lives_ok($$select public.accept_invitation('valid')$$, 'repeat remains idempotent after email change');
reset role;
update auth.users set email = 'invite@showcrafter.test', email_confirmed_at = now() where id = tests.get_supabase_uid('organisation_owner');
select tests.act_as('organisation_owner');
select throws_ok($$select public.accept_invitation('valid')$$, '42501', null, 'another user with the former email cannot repeat acceptance');
reset role;
select finish();
