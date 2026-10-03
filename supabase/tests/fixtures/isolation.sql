-- Remove application fixtures only inside the enclosing rollback-only test transaction.
create function tests.clear_application_data()
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
declare
  v_tables text;
begin
  select string_agg(format('%I.%I',table_schema,table_name),',') into v_tables
  from information_schema.tables as application_table
  where application_table.table_schema = 'public' and application_table.table_type = 'BASE TABLE';
  if v_tables is not null then execute 'truncate table ' || v_tables || ' restart identity cascade'; end if;
  -- Seed identities have stable local UUIDs. Application tables have already been emptied.
  delete from auth.users where id between '10000000-0000-4000-8000-000000000001'::uuid
    and '10000000-0000-4000-8000-000000000007'::uuid;
end;
$$;
