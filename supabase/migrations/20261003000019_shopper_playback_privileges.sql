-- Public page readers have narrowly scoped invoker wrappers and privileged implementations.
revoke all on function public.store_page_by_slug(text), private.store_page_by_slug(text),
  public.product_for_store(text,uuid), private.product_for_store(text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.store_page_by_slug(text), private.store_page_by_slug(text),
  public.product_for_store(text,uuid), private.product_for_store(text,uuid) to anon, authenticated, service_role;
