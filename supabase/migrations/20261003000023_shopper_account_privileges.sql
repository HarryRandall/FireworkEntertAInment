-- Only authenticated identities, including anonymous shoppers, can use owned list operations.
revoke all on function public.add_shopper_list(uuid,uuid,uuid,uuid,int),private.add_shopper_list(uuid,uuid,uuid,uuid,int) from public,anon,authenticated,service_role;
grant execute on function public.add_shopper_list(uuid,uuid,uuid,uuid,int),private.add_shopper_list(uuid,uuid,uuid,uuid,int) to authenticated;
revoke all on function public.set_list_quantity(uuid,uuid,int),private.set_list_quantity(uuid,uuid,int) from public,anon,authenticated,service_role;
grant execute on function public.set_list_quantity(uuid,uuid,int),private.set_list_quantity(uuid,uuid,int) to authenticated;
revoke all on function public.shopper_account(),private.shopper_account() from public,anon,authenticated,service_role;
grant execute on function public.shopper_account(),private.shopper_account() to authenticated;
revoke all on function private.list_sale_end(uuid) from public,anon,authenticated,service_role;
revoke all on table private.shopper_list_requests from public,anon,authenticated,service_role;
