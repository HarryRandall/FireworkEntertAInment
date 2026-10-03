-- Synthetic submissions and proposals, created only within an imports suite transaction.
create function tests.candidate_proposal()
returns jsonb language sql set search_path = '' as $$
  select jsonb_build_object('effects', jsonb_build_object('a', jsonb_build_object('template', 'published-effect', 'overrides', jsonb_build_object('launch', jsonb_build_object('height_m', 70)))), 'composition', tests.composition_fixture());
$$;
comment on function tests.candidate_proposal() is 'Returns a valid template-and-overrides candidate with a measured composition fixture.';
create function tests.create_import_fixture()
returns void language plpgsql set search_path = '' as $$
#variable_conflict error
begin
  perform tests.create_catalogue_fixture();
  update public.effects set is_template = true where slug = 'published-effect';
  insert into public.media(id,bucket,path,kind,mime,bytes,sha256,supplier_id,uploaded_by) values
    ('30000000-0000-0000-0000-000000000005','imports','first/prices.csv','price_list','text/csv',1,repeat('e',64),'20000000-0000-0000-0000-000000000001',tests.get_supabase_uid('supplier_member')),
    ('30000000-0000-0000-0000-000000000006','imports','other/prices.csv','price_list','text/csv',1,repeat('f',64),'20000000-0000-0000-0000-000000000002',tests.get_supabase_uid('other_supplier_member'));
  insert into public.imports(id,supplier_id,media_id,submitted_by,stage) values
    ('80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000005',tests.get_supabase_uid('supplier_member'),'review'),
    ('80000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000006',tests.get_supabase_uid('other_supplier_member'),'uploaded');
  insert into public.import_lines(id,import_id,row_number,raw,state) values
    ('81000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001',1,'{"code":"FIRST"}','suggested'),
    ('81000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000002',1,'{"code":"OTHER"}','new');
  insert into public.video_analyses(id,media_id,product_id,extractor,status) values
    ('82000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','fixture','ready'),
    ('82000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002',null,'fixture','ready');
  insert into public.design_candidates(id,analysis_id,source,proposal,renderer) values
    ('83000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','fit',tests.candidate_proposal(),'fixture'),
    ('83000000-0000-0000-0000-000000000002','82000000-0000-0000-0000-000000000002','manual',tests.candidate_proposal(),'fixture');
  insert into public.reviews(id,effect_version_id,reviewer_id,decision) values
    ('84000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002',tests.get_supabase_uid('platform_staff'),'comment');
end;
$$;
comment on function tests.create_import_fixture() is 'Creates two suppliers, two organisations and synthetic price-list/video evidence with ready proposals.';

-- Counts mutations as the active persona without bypassing policies.
create function tests.import_affected_rows(p_statement text)
returns bigint language plpgsql set search_path = '' as $$
#variable_conflict error
declare v_affected bigint;
begin execute p_statement; get diagnostics v_affected = row_count; return v_affected; end;
$$;
comment on function tests.import_affected_rows(text) is 'Returns the number of rows affected by a policy-tested mutation as the current caller.';
