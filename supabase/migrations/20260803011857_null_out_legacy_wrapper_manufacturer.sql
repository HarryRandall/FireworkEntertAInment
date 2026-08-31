-- Remove the legacy wrapper sentinel now that manufacturer is user-facing.

update public.catalogue_items
set manufacturer = null
where manufacturer = 'auto-generated wrapper';
