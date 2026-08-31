-- Add the SELECT and admin-write RLS policies that were missing from
-- 20260511030304_product_effect_sequences_and_clean_ha_specs.sql.
--
-- product_effect_sequences was created with RLS enabled but no policies,
-- so the authenticated SSR client silently fetched zero rows. The replay
-- pipeline relies on this table to expand each product cue into one
-- ReplayCue per shot, so the bug surfaced as "multi-shot products only
-- fire a single shot" in the browser preview.

CREATE POLICY product_effect_sequences_select_authenticated
  ON public.product_effect_sequences
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY product_effect_sequences_admin_write
  ON public.product_effect_sequences
  FOR ALL
  USING (public.has_permission(auth.uid(), 'admin.manage_catalogue'))
  WITH CHECK (public.has_permission(auth.uid(), 'admin.manage_catalogue'));
