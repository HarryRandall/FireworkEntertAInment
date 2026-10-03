-- Synthetic local Auth identities. Never apply this seed to a hosted database.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,is_anonymous,confirmation_token,recovery_token,
  email_change_token_new,email_change,created_at,updated_at)
select ('10000000-0000-4000-8000-' || lpad(persona.ordinal::text,12,'0'))::uuid,
  '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  persona.name || '@showcrafter.test',extensions.crypt('LocalShowcrafter123!',extensions.gen_salt('bf')),
  now(),'{"provider":"email","providers":["email"]}',jsonb_build_object('display_name',persona.name),
  false,'','','','',now(),now()
from (values (1,'admin'),(2,'owner'),(3,'manager'),(4,'supplier'),(5,'other-owner'),(6,'shopper')) as persona(ordinal,name);
insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
select id,id,id::text,jsonb_build_object('sub',id,'email',email,'email_verified',true),
  'email',now(),now(),now() from auth.users where email like '%@showcrafter.test';
insert into auth.users(id,instance_id,aud,role,is_anonymous,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('10000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000',
'authenticated','authenticated',true,'{}','{"display_name":"Anonymous shopper"}',now(),now());
insert into public.staff_roles(profile_id,role,requires_mfa)
values ('10000000-0000-4000-8000-000000000001','super_admin',false);
insert into public.suppliers(id,name,slug,country) values
('20000000-0000-4000-8000-000000000001','Demo Fireworks Supplier','demo-supplier','GB');
insert into public.supplier_members(supplier_id,profile_id,role) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','owner');
commit;
