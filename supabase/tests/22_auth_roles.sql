-- API role discovery delegates to the existing table-backed identity fence.
select no_plan();
select tests.create_personas();
insert into public.staff_roles (profile_id, role) values (tests.get_supabase_uid('platform_staff'), 'reviewer');
select tests.act_as('platform_staff');
select is(public.current_staff_role(), 'reviewer', 'non-admin staff can inspect their own fenced role');
reset role;
select tests.act_as('signed_in_shopper');
select is(public.current_staff_role(), null, 'shopper cannot acquire staff rights');
reset role;
reset role;
update public.profiles set status = 'suspended' where id = tests.get_supabase_uid('platform_staff');
select tests.act_as('platform_staff');
select is(public.current_staff_role(), null, 'suspended staff assignment grants no access');
reset role;
select tests.act_as('anonymous_shopper');
select is(public.current_staff_role(), null, 'anonymous caller has no staff role');
reset role;
-- Check the grant rather than calling as anon: a denied direct call can crash Postgres
-- through the supautils role-hints bug (supabase/supautils issue 214).
select ok(not has_function_privilege('anon', 'public.current_staff_role()', 'EXECUTE'), 'public caller cannot inspect a staff role');
select finish();
