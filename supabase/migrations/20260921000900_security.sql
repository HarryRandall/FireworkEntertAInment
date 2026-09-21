-- ShowCrafter baseline: security.
set check_function_bodies = false;

COMMENT ON CONSTRAINT "firework_style_defaults_kind_check" ON "public"."firework_style_defaults" IS 'Restricts reusable renderer defaults to editor-supported effect sections, including geometry.';

CREATE OR REPLACE TRIGGER "ai_credit_accounts_set_updated_at" BEFORE UPDATE ON "public"."ai_credit_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "ai_credit_costs_set_updated_at" BEFORE UPDATE ON "public"."ai_credit_costs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "assortment_items_set_updated_at" BEFORE UPDATE ON "public"."assortment_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "assortment_public_links_set_updated_at" BEFORE UPDATE ON "public"."assortment_public_links" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "assortments_create_public_link" AFTER INSERT ON "public"."assortments" FOR EACH ROW EXECUTE FUNCTION "private"."create_assortment_public_link"();

CREATE OR REPLACE TRIGGER "assortments_set_updated_at" BEFORE UPDATE ON "public"."assortments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "catalogue_items_assert_timeline_safety" AFTER INSERT OR DELETE OR UPDATE ON "public"."catalogue_items" FOR EACH ROW EXECUTE FUNCTION "private"."assert_show_timeline_for_catalogue_item"();

CREATE OR REPLACE TRIGGER "catalogue_items_block_linked_delete" BEFORE DELETE ON "public"."catalogue_items" FOR EACH ROW EXECUTE FUNCTION "public"."block_linked_catalogue_item_delete"();

CREATE OR REPLACE TRIGGER "catalogue_items_lock_timeline_sources" BEFORE INSERT OR DELETE OR UPDATE ON "public"."catalogue_items" FOR EACH STATEMENT EXECUTE FUNCTION "private"."lock_show_timeline_sources_exclusive"();

CREATE OR REPLACE TRIGGER "catalogue_items_set_updated_at" BEFORE UPDATE ON "public"."catalogue_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "catalogue_items_sync_multishot_dependencies_insert" AFTER INSERT ON "public"."catalogue_items" FOR EACH ROW EXECUTE FUNCTION "private"."sync_multishots_from_catalogue_duration"();

CREATE OR REPLACE TRIGGER "catalogue_items_sync_multishot_dependencies_update" AFTER UPDATE OF "duration_seconds", "firework_id" ON "public"."catalogue_items" FOR EACH ROW WHEN ((("old"."duration_seconds" IS DISTINCT FROM "new"."duration_seconds") OR ("old"."firework_id" IS DISTINCT FROM "new"."firework_id"))) EXECUTE FUNCTION "private"."sync_multishots_from_catalogue_duration"();

CREATE OR REPLACE TRIGGER "catalogue_items_validate_published_timing" AFTER UPDATE OF "part_number", "duration_seconds", "firework_id", "multishot_id" ON "public"."catalogue_items" FOR EACH ROW WHEN ((("old"."part_number" IS DISTINCT FROM "new"."part_number") OR ("old"."duration_seconds" IS DISTINCT FROM "new"."duration_seconds") OR ("old"."firework_id" IS DISTINCT FROM "new"."firework_id") OR ("old"."multishot_id" IS DISTINCT FROM "new"."multishot_id"))) EXECUTE FUNCTION "private"."validate_catalogue_timing_dependencies"();

CREATE OR REPLACE TRIGGER "enforce_supported_song_analysis_source_licence" BEFORE INSERT OR UPDATE OF "source_provider", "source_track_id", "source_title", "source_artist", "source_url", "source_licence_name", "source_licence_url" ON "public"."song_analyses" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_supported_song_analysis_source_licence"();

CREATE OR REPLACE TRIGGER "firework_effects_bump_preview_images" AFTER UPDATE OF "model_json", "pattern_key" ON "public"."firework_effects" FOR EACH ROW WHEN ((("old"."model_json" IS DISTINCT FROM "new"."model_json") OR ("old"."pattern_key" IS DISTINCT FROM "new"."pattern_key"))) EXECUTE FUNCTION "private"."bump_effect_preview_images"();

CREATE OR REPLACE TRIGGER "firework_effects_ensure_preview_image" AFTER INSERT ON "public"."firework_effects" FOR EACH ROW EXECUTE FUNCTION "private"."ensure_firework_preview_image"();

CREATE OR REPLACE TRIGGER "firework_effects_set_updated_at" BEFORE UPDATE ON "public"."firework_effects" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "firework_style_defaults_set_updated_at" BEFORE UPDATE ON "public"."firework_style_defaults" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "firework_variants_set_updated_at" BEFORE UPDATE ON "public"."fireworks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "fireworks_assert_timeline_safety" AFTER INSERT OR DELETE OR UPDATE ON "public"."fireworks" FOR EACH ROW EXECUTE FUNCTION "private"."assert_show_timeline_for_firework"();

CREATE OR REPLACE TRIGGER "fireworks_bump_preview_images" AFTER UPDATE OF "firework_effect_id", "primary_color", "secondary_color", "color_palette", "caliber", "duration_seconds", "height_meters", "variant_json", "render_overrides_json" ON "public"."fireworks" FOR EACH ROW WHEN (((((((((("old"."firework_effect_id" IS DISTINCT FROM "new"."firework_effect_id") OR ("old"."primary_color" IS DISTINCT FROM "new"."primary_color")) OR ("old"."secondary_color" IS DISTINCT FROM "new"."secondary_color")) OR ("old"."color_palette" IS DISTINCT FROM "new"."color_palette")) OR ("old"."caliber" IS DISTINCT FROM "new"."caliber")) OR ("old"."duration_seconds" IS DISTINCT FROM "new"."duration_seconds")) OR ("old"."height_meters" IS DISTINCT FROM "new"."height_meters")) OR ("old"."variant_json" IS DISTINCT FROM "new"."variant_json")) OR ("old"."render_overrides_json" IS DISTINCT FROM "new"."render_overrides_json"))) EXECUTE FUNCTION "private"."bump_firework_preview_images"();

CREATE OR REPLACE TRIGGER "fireworks_ensure_catalogue_item" AFTER INSERT ON "public"."fireworks" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_catalogue_item_for_firework"();

CREATE OR REPLACE TRIGGER "fireworks_ensure_preview_image" AFTER INSERT ON "public"."fireworks" FOR EACH ROW EXECUTE FUNCTION "private"."ensure_firework_preview_image"();

CREATE OR REPLACE TRIGGER "fireworks_lock_timeline_sources" BEFORE INSERT OR DELETE OR UPDATE ON "public"."fireworks" FOR EACH STATEMENT EXECUTE FUNCTION "private"."lock_show_timeline_sources_exclusive"();

CREATE OR REPLACE TRIGGER "fireworks_sync_multishot_dependencies" AFTER UPDATE OF "duration_seconds" ON "public"."fireworks" FOR EACH ROW WHEN (("old"."duration_seconds" IS DISTINCT FROM "new"."duration_seconds")) EXECUTE FUNCTION "private"."sync_multishots_from_firework_duration"();

CREATE OR REPLACE TRIGGER "fireworks_validate_published_timing" AFTER UPDATE OF "duration_seconds" ON "public"."fireworks" FOR EACH ROW WHEN (("old"."duration_seconds" IS DISTINCT FROM "new"."duration_seconds")) EXECUTE FUNCTION "private"."validate_firework_timing_dependencies"();

CREATE OR REPLACE TRIGGER "generation_settings_set_updated_at" BEFORE UPDATE ON "public"."generation_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "impersonation_sessions_set_updated_at" BEFORE UPDATE ON "public"."impersonation_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "import_jobs_set_updated_at" BEFORE UPDATE ON "public"."import_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "import_runs_mark_worker_claimed_before_processing" BEFORE UPDATE OF "status" ON "public"."import_runs" FOR EACH ROW EXECUTE FUNCTION "private"."mark_firework_import_worker_claimed"();

CREATE OR REPLACE TRIGGER "import_runs_set_updated_at" BEFORE UPDATE ON "public"."import_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "multishot_fireworks_assert_timeline_safety" AFTER INSERT OR DELETE OR UPDATE ON "public"."multishot_fireworks" FOR EACH ROW EXECUTE FUNCTION "private"."assert_show_timeline_for_multishot_shot"();

CREATE OR REPLACE TRIGGER "multishot_fireworks_lock_timeline_sources" BEFORE INSERT OR DELETE OR UPDATE ON "public"."multishot_fireworks" FOR EACH STATEMENT EXECUTE FUNCTION "private"."lock_show_timeline_sources_exclusive"();

CREATE OR REPLACE TRIGGER "multishot_fireworks_sync_derived_state" AFTER INSERT OR DELETE OR UPDATE ON "public"."multishot_fireworks" FOR EACH ROW EXECUTE FUNCTION "private"."sync_multishot_derived_state_from_shot"();

CREATE OR REPLACE TRIGGER "multishot_fireworks_validate_published_timing" AFTER INSERT OR DELETE OR UPDATE ON "public"."multishot_fireworks" FOR EACH ROW EXECUTE FUNCTION "private"."validate_multishot_shot_timing_dependencies"();

CREATE OR REPLACE TRIGGER "multishots_bump_preview_image" AFTER UPDATE ON "public"."multishots" FOR EACH ROW EXECUTE FUNCTION "private"."bump_multishot_preview_image"();

CREATE OR REPLACE TRIGGER "multishots_enforce_minimum_duration" BEFORE UPDATE OF "duration_seconds" ON "public"."multishots" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_multishot_minimum_duration"();

CREATE OR REPLACE TRIGGER "multishots_ensure_catalogue_item" AFTER INSERT ON "public"."multishots" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_catalogue_item_for_multishot"();

CREATE OR REPLACE TRIGGER "multishots_ensure_preview_image" AFTER INSERT ON "public"."multishots" FOR EACH ROW EXECUTE FUNCTION "private"."ensure_firework_preview_image"();

CREATE OR REPLACE TRIGGER "multishots_raise_catalogue_duration" AFTER UPDATE OF "duration_seconds" ON "public"."multishots" FOR EACH ROW WHEN (("old"."duration_seconds" IS DISTINCT FROM "new"."duration_seconds")) EXECUTE FUNCTION "private"."raise_catalogue_multishot_duration"();

CREATE OR REPLACE TRIGGER "multishots_set_updated_at" BEFORE UPDATE ON "public"."multishots" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "music_analyses_set_updated_at" BEFORE UPDATE ON "public"."song_analyses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "permissions_set_updated_at" BEFORE UPDATE ON "public"."permissions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "prompt_configs_set_updated_at" BEFORE UPDATE ON "public"."prompt_configs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "record_exhausted_song_analysis_dead_letter" AFTER UPDATE OF "status" ON "public"."song_analyses" FOR EACH ROW EXECUTE FUNCTION "private"."record_exhausted_song_analysis_dead_letter"();

CREATE OR REPLACE TRIGGER "roles_set_updated_at" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "show_analyses_set_updated_at" BEFORE UPDATE ON "public"."show_generation_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "show_cues_set_updated_at" BEFORE UPDATE ON "public"."show_timeline_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "show_preset_likes_sync_count" AFTER INSERT OR DELETE ON "public"."show_preset_likes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_show_preset_like_count"();

CREATE OR REPLACE TRIGGER "show_presets_lock_timeline_sources" BEFORE INSERT OR DELETE OR UPDATE ON "public"."show_presets" FOR EACH STATEMENT EXECUTE FUNCTION "private"."lock_show_timeline_sources_shared"();

CREATE OR REPLACE TRIGGER "show_presets_validate_publication" BEFORE INSERT OR UPDATE ON "public"."show_presets" FOR EACH ROW EXECUTE FUNCTION "private"."validate_show_preset_publication"();

CREATE OR REPLACE TRIGGER "show_templates_set_updated_at" BEFORE UPDATE ON "public"."show_presets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "show_timeline_items_lock_sources" BEFORE INSERT OR DELETE OR UPDATE ON "public"."show_timeline_items" FOR EACH STATEMENT EXECUTE FUNCTION "private"."lock_show_timeline_sources_shared"();

CREATE OR REPLACE TRIGGER "show_timeline_items_reject_overlap" BEFORE INSERT OR UPDATE OF "show_id", "time_seconds", "catalogue_item_id", "launch_position_index" ON "public"."show_timeline_items" FOR EACH ROW EXECUTE FUNCTION "private"."reject_overlapping_show_timeline_item"();

CREATE OR REPLACE TRIGGER "shows_set_updated_at" BEFORE UPDATE ON "public"."shows" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "supplier_inventory_items_set_updated_at" BEFORE UPDATE ON "public"."supplier_inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "supplier_profiles_set_updated_at" BEFORE UPDATE ON "public"."supplier_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "user_permission_overrides_set_updated_at" BEFORE UPDATE ON "public"."user_permission_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "users_ai_credit_account" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "private"."ensure_ai_credit_account_for_user"();

ALTER TABLE "public"."ai_credit_accounts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_credit_accounts_select_own_or_billing_admin" ON "public"."ai_credit_accounts" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."current_user_has_permission"('admin.manage_billing'::"text")));

ALTER TABLE "public"."ai_credit_costs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_credit_costs_billing_admin_delete" ON "public"."ai_credit_costs" FOR DELETE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_billing'::"text") AS "current_user_has_permission"));

CREATE POLICY "ai_credit_costs_billing_admin_insert" ON "public"."ai_credit_costs" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_billing'::"text") AS "current_user_has_permission"));

CREATE POLICY "ai_credit_costs_billing_admin_update" ON "public"."ai_credit_costs" FOR UPDATE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_billing'::"text") AS "current_user_has_permission")) WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_billing'::"text") AS "current_user_has_permission"));

CREATE POLICY "ai_credit_costs_select_authenticated" ON "public"."ai_credit_costs" FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."ai_credit_transactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_credit_transactions_select_own_or_billing_admin" ON "public"."ai_credit_transactions" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."current_user_has_permission"('admin.manage_billing'::"text")));

ALTER TABLE "public"."assortment_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assortment_items_admin_delete" ON "public"."assortment_items" FOR DELETE USING ("public"."current_user_has_permission"('admin.manage_assortments'::"text"));

CREATE POLICY "assortment_items_admin_insert" ON "public"."assortment_items" FOR INSERT WITH CHECK ("public"."current_user_has_permission"('admin.manage_assortments'::"text"));

CREATE POLICY "assortment_items_admin_update" ON "public"."assortment_items" FOR UPDATE USING ("public"."current_user_has_permission"('admin.manage_assortments'::"text")) WITH CHECK ("public"."current_user_has_permission"('admin.manage_assortments'::"text"));

CREATE POLICY "assortment_items_select_admin" ON "public"."assortment_items" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('admin.manage_assortments'::"text"));

CREATE POLICY "assortment_items_select_public" ON "public"."assortment_items" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."assortments" "a"
  WHERE (("a"."id" = "assortment_items"."assortment_id") AND ("a"."is_active" = true)))));

ALTER TABLE "public"."assortment_public_links" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assortment_public_links_select_admin" ON "public"."assortment_public_links" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('admin.manage_assortments'::"text"));

ALTER TABLE "public"."assortment_song_selections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assortment_song_selections_select_funder" ON "public"."assortment_song_selections" FOR SELECT TO "authenticated" USING (("funding_user_id" = ( SELECT "auth"."uid"() AS "uid")));

ALTER TABLE "public"."assortments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assortments_admin_delete" ON "public"."assortments" FOR DELETE USING ("public"."current_user_has_permission"('admin.manage_assortments'::"text"));

CREATE POLICY "assortments_admin_insert" ON "public"."assortments" FOR INSERT WITH CHECK ("public"."current_user_has_permission"('admin.manage_assortments'::"text"));

CREATE POLICY "assortments_admin_update" ON "public"."assortments" FOR UPDATE USING ("public"."current_user_has_permission"('admin.manage_assortments'::"text")) WITH CHECK ("public"."current_user_has_permission"('admin.manage_assortments'::"text"));

CREATE POLICY "assortments_select_admin" ON "public"."assortments" FOR SELECT TO "authenticated" USING ("public"."current_user_has_permission"('admin.manage_assortments'::"text"));

CREATE POLICY "assortments_select_public" ON "public"."assortments" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));

ALTER TABLE "public"."backend_dead_letters" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backend_dead_letters_service_role_manage" ON "public"."backend_dead_letters" TO "service_role" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));

ALTER TABLE "public"."catalogue_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogue_items_admin_delete" ON "public"."catalogue_items" FOR DELETE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "catalogue_items_admin_insert" ON "public"."catalogue_items" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "catalogue_items_admin_update" ON "public"."catalogue_items" FOR UPDATE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission")) WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "catalogue_items_select_listed_anon" ON "public"."catalogue_items" FOR SELECT TO "anon" USING ("is_listed");

CREATE POLICY "catalogue_items_select_listed_or_admin" ON "public"."catalogue_items" FOR SELECT TO "authenticated" USING (("is_listed" OR ( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission")));

ALTER TABLE "public"."firework_editor_versions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firework_editor_versions_admin_insert" ON "public"."firework_editor_versions" FOR INSERT WITH CHECK ("public"."current_user_has_permission"('admin.manage_catalogue'::"text"));

CREATE POLICY "firework_editor_versions_admin_select" ON "public"."firework_editor_versions" FOR SELECT USING ("public"."current_user_has_permission"('admin.manage_catalogue'::"text"));

ALTER TABLE "public"."firework_effects" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firework_effects_admin_delete" ON "public"."firework_effects" FOR DELETE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "firework_effects_admin_insert" ON "public"."firework_effects" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "firework_effects_admin_update" ON "public"."firework_effects" FOR UPDATE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission")) WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "firework_effects_select_anyone" ON "public"."firework_effects" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."firework_preview_images" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firework_preview_images_select_anyone" ON "public"."firework_preview_images" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."firework_style_defaults" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firework_style_defaults_admin_delete" ON "public"."firework_style_defaults" FOR DELETE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "firework_style_defaults_admin_insert" ON "public"."firework_style_defaults" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "firework_style_defaults_admin_update" ON "public"."firework_style_defaults" FOR UPDATE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission")) WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "firework_style_defaults_select_authenticated" ON "public"."firework_style_defaults" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));

ALTER TABLE "public"."fireworks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fireworks_admin_delete" ON "public"."fireworks" FOR DELETE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "fireworks_admin_insert" ON "public"."fireworks" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "fireworks_admin_update" ON "public"."fireworks" FOR UPDATE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission")) WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "fireworks_select_anyone" ON "public"."fireworks" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."generation_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generation_settings_admin_read" ON "public"."generation_settings" FOR SELECT TO "authenticated" USING ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND ( SELECT "public"."current_user_has_permission"('admin.manage_prompts'::"text") AS "current_user_has_permission")));

ALTER TABLE "public"."impersonation_sessions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "impersonation_sessions_admin_select" ON "public"."impersonation_sessions" FOR SELECT USING ("public"."current_user_has_permission"('admin.impersonate_users'::"text"));

ALTER TABLE "public"."import_candidate_render_validations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_candidate_render_validations_admin_select" ON "public"."import_candidate_render_validations" FOR SELECT TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission"));

ALTER TABLE "public"."import_candidate_validations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_candidate_validations_admin_select" ON "public"."import_candidate_validations" FOR SELECT TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission"));

ALTER TABLE "public"."import_candidates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_candidates_admin_select" ON "public"."import_candidates" FOR SELECT TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission"));

ALTER TABLE "public"."import_jobs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_jobs_admin_delete" ON "public"."import_jobs" FOR DELETE TO "authenticated" USING ((( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission") AND ("kind" <> 'firework_video'::"text")));

CREATE POLICY "import_jobs_admin_insert" ON "public"."import_jobs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission") AND ("kind" <> 'firework_video'::"text")));

CREATE POLICY "import_jobs_admin_select" ON "public"."import_jobs" FOR SELECT TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission"));

CREATE POLICY "import_jobs_admin_update" ON "public"."import_jobs" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission") AND ("kind" <> 'firework_video'::"text"))) WITH CHECK ((( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission") AND ("kind" <> 'firework_video'::"text")));

ALTER TABLE "public"."import_outputs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_outputs_admin_delete" ON "public"."import_outputs" FOR DELETE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission"));

CREATE POLICY "import_outputs_admin_insert" ON "public"."import_outputs" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission"));

CREATE POLICY "import_outputs_admin_select" ON "public"."import_outputs" FOR SELECT TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission"));

CREATE POLICY "import_outputs_admin_update" ON "public"."import_outputs" FOR UPDATE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission")) WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission"));

ALTER TABLE "public"."import_run_outputs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_run_outputs_admin_select" ON "public"."import_run_outputs" FOR SELECT TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission"));

ALTER TABLE "public"."import_runs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_runs_admin_select" ON "public"."import_runs" FOR SELECT TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission"));

ALTER TABLE "public"."jamendo_response_cache" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jamendo_response_cache_no_client_access" ON "public"."jamendo_response_cache" TO "authenticated", "anon" USING (false) WITH CHECK (false);

ALTER TABLE "public"."media_assets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_assets_admin_delete" ON "public"."media_assets" FOR DELETE TO "authenticated" USING ((( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."import_jobs" "job"
  WHERE (("job"."media_asset_id" = "media_assets"."id") AND ("job"."kind" = 'firework_video'::"text")))))));

CREATE POLICY "media_assets_admin_update" ON "public"."media_assets" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."import_jobs" "job"
  WHERE (("job"."media_asset_id" = "media_assets"."id") AND ("job"."kind" = 'firework_video'::"text"))))))) WITH CHECK ((( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission") AND (NOT (EXISTS ( SELECT 1
   FROM "public"."import_jobs" "job"
  WHERE (("job"."media_asset_id" = "media_assets"."id") AND ("job"."kind" = 'firework_video'::"text")))))));

CREATE POLICY "media_assets_insert_allowed" ON "public"."media_assets" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND ("owner_id" = ( SELECT "auth"."uid"() AS "uid"))) OR ( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission")));

CREATE POLICY "media_assets_select_allowed" ON "public"."media_assets" FOR SELECT TO "authenticated" USING ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."current_user_has_permission"('admin.manage_imports'::"text") AS "current_user_has_permission")));

ALTER TABLE "public"."multishot_fireworks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "multishot_fireworks_admin_delete" ON "public"."multishot_fireworks" FOR DELETE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "multishot_fireworks_admin_insert" ON "public"."multishot_fireworks" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "multishot_fireworks_admin_update" ON "public"."multishot_fireworks" FOR UPDATE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission")) WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "multishot_fireworks_select_anyone" ON "public"."multishot_fireworks" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."multishots" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "multishots_admin_delete" ON "public"."multishots" FOR DELETE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "multishots_admin_insert" ON "public"."multishots" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "multishots_admin_update" ON "public"."multishots" FOR UPDATE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission")) WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "multishots_select_anyone" ON "public"."multishots" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_read_authenticated" ON "public"."permissions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));

ALTER TABLE "public"."prompt_configs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_configs_admin_read" ON "public"."prompt_configs" FOR SELECT TO "authenticated" USING ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND ( SELECT "public"."current_user_has_permission"('admin.manage_prompts'::"text") AS "current_user_has_permission")));

ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_admin_delete" ON "public"."role_permissions" FOR DELETE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_users'::"text") AS "current_user_has_permission"));

CREATE POLICY "role_permissions_admin_insert" ON "public"."role_permissions" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_users'::"text") AS "current_user_has_permission"));

CREATE POLICY "role_permissions_admin_update" ON "public"."role_permissions" FOR UPDATE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_users'::"text") AS "current_user_has_permission")) WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_users'::"text") AS "current_user_has_permission"));

CREATE POLICY "role_permissions_read_authenticated" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));

ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_read_authenticated" ON "public"."roles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") IS NOT NULL));

ALTER TABLE "public"."show_assortment_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "show_assortment_items_select_owner" ON "public"."show_assortment_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."shows" "show_row"
  WHERE (("show_row"."id" = "show_assortment_items"."show_id") AND ("show_row"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));

ALTER TABLE "public"."show_assortment_selections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "show_assortment_selections_delete" ON "public"."show_assortment_selections" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."shows"
  WHERE (("shows"."id" = "show_assortment_selections"."show_id") AND ("shows"."user_id" = "auth"."uid"())))));

CREATE POLICY "show_assortment_selections_insert" ON "public"."show_assortment_selections" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."shows"
  WHERE (("shows"."id" = "show_assortment_selections"."show_id") AND ("shows"."user_id" = "auth"."uid"())))));

CREATE POLICY "show_assortment_selections_select" ON "public"."show_assortment_selections" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."shows"
  WHERE (("shows"."id" = "show_assortment_selections"."show_id") AND ("shows"."user_id" = "auth"."uid"())))));

ALTER TABLE "public"."show_generation_runs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "show_generation_runs_delete_own" ON "public"."show_generation_runs" FOR DELETE TO "authenticated" USING ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."shows" "show_row"
  WHERE (("show_row"."id" = "show_generation_runs"."show_id") AND ("show_row"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));

CREATE POLICY "show_generation_runs_insert_own" ON "public"."show_generation_runs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."shows" "show_row"
  WHERE (("show_row"."id" = "show_generation_runs"."show_id") AND ("show_row"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));

CREATE POLICY "show_generation_runs_select_own" ON "public"."show_generation_runs" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."shows" "show_row"
  WHERE (("show_row"."id" = "show_generation_runs"."show_id") AND ("show_row"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));

CREATE POLICY "show_generation_runs_update_own" ON "public"."show_generation_runs" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."shows" "show_row"
  WHERE (("show_row"."id" = "show_generation_runs"."show_id") AND ("show_row"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."shows" "show_row"
  WHERE (("show_row"."id" = "show_generation_runs"."show_id") AND ("show_row"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));

ALTER TABLE "public"."show_preset_like_counts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "show_preset_like_counts_read_anyone" ON "public"."show_preset_like_counts" FOR SELECT TO "authenticated", "anon" USING (true);

ALTER TABLE "public"."show_preset_likes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "show_preset_likes_delete_own" ON "public"."show_preset_likes" FOR DELETE TO "authenticated" USING ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") = "user_id")));

CREATE POLICY "show_preset_likes_insert_own" ON "public"."show_preset_likes" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."show_presets" "preset"
  WHERE (("preset"."id" = "show_preset_likes"."show_preset_id") AND "preset"."is_published")))));

CREATE POLICY "show_preset_likes_select_own" ON "public"."show_preset_likes" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

ALTER TABLE "public"."show_presets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "show_presets_admin_delete" ON "public"."show_presets" FOR DELETE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "show_presets_admin_insert" ON "public"."show_presets" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "show_presets_admin_update" ON "public"."show_presets" FOR UPDATE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission")) WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission"));

CREATE POLICY "show_presets_read_published_anon" ON "public"."show_presets" FOR SELECT TO "anon" USING ("is_published");

CREATE POLICY "show_presets_read_published_or_admin" ON "public"."show_presets" FOR SELECT TO "authenticated" USING (("is_published" OR ( SELECT "public"."current_user_has_permission"('admin.manage_catalogue'::"text") AS "current_user_has_permission")));

ALTER TABLE "public"."show_timeline_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "show_timeline_items_select_via_show" ON "public"."show_timeline_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."shows" "show_row"
  WHERE (("show_row"."id" = "show_timeline_items"."show_id") AND ("show_row"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));

ALTER TABLE "public"."shows" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shows_delete_own" ON "public"."shows" FOR DELETE TO "authenticated" USING ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") = "user_id")));

CREATE POLICY "shows_insert_own" ON "public"."shows" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") = "user_id")));

CREATE POLICY "shows_select_own" ON "public"."shows" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "shows_update_own" ON "public"."shows" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") = "user_id"))) WITH CHECK ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") = "user_id")));

ALTER TABLE "public"."song_analyses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "song_analyses_delete_own" ON "public"."song_analyses" FOR DELETE TO "authenticated" USING ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));

CREATE POLICY "song_analyses_insert_own" ON "public"."song_analyses" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));

CREATE POLICY "song_analyses_select_own" ON "public"."song_analyses" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));

CREATE POLICY "song_analyses_update_own" ON "public"."song_analyses" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND ("user_id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));

CREATE POLICY "supplier_inventory_delete_allowed" ON "public"."supplier_inventory_items" FOR DELETE TO "authenticated" USING ((( SELECT "public"."current_user_has_permission"('admin.manage_suppliers'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.manage_stock'::"text") AS "current_user_has_permission")));

CREATE POLICY "supplier_inventory_insert_allowed" ON "public"."supplier_inventory_items" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."current_user_has_permission"('admin.manage_suppliers'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.manage_stock'::"text") AS "current_user_has_permission")));

ALTER TABLE "public"."supplier_inventory_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_inventory_select_allowed" ON "public"."supplier_inventory_items" FOR SELECT TO "authenticated" USING ((( SELECT "public"."current_user_has_permission"('admin.manage_suppliers'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.view'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.manage_stock'::"text") AS "current_user_has_permission")));

CREATE POLICY "supplier_inventory_select_public_prices" ON "public"."supplier_inventory_items" FOR SELECT TO "authenticated", "anon" USING ((("available" = true) AND ("price_cents" IS NOT NULL)));

CREATE POLICY "supplier_inventory_update_allowed" ON "public"."supplier_inventory_items" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."current_user_has_permission"('admin.manage_suppliers'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.manage_stock'::"text") AS "current_user_has_permission"))) WITH CHECK ((( SELECT "public"."current_user_has_permission"('admin.manage_suppliers'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.manage_stock'::"text") AS "current_user_has_permission")));

ALTER TABLE "public"."supplier_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_profiles_delete_allowed" ON "public"."supplier_profiles" FOR DELETE TO "authenticated" USING ((( SELECT "public"."current_user_has_permission"('admin.manage_suppliers'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.manage_stock'::"text") AS "current_user_has_permission")));

CREATE POLICY "supplier_profiles_insert_allowed" ON "public"."supplier_profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."current_user_has_permission"('admin.manage_suppliers'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.manage_stock'::"text") AS "current_user_has_permission")));

CREATE POLICY "supplier_profiles_select_allowed" ON "public"."supplier_profiles" FOR SELECT TO "authenticated" USING ((( SELECT "public"."current_user_has_permission"('admin.manage_suppliers'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.view'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.manage_stock'::"text") AS "current_user_has_permission")));

CREATE POLICY "supplier_profiles_update_allowed" ON "public"."supplier_profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."current_user_has_permission"('admin.manage_suppliers'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.manage_stock'::"text") AS "current_user_has_permission"))) WITH CHECK ((( SELECT "public"."current_user_has_permission"('admin.manage_suppliers'::"text") AS "current_user_has_permission") OR ( SELECT "public"."current_user_has_permission"('supplier.manage_stock'::"text") AS "current_user_has_permission")));

ALTER TABLE "public"."user_permission_overrides" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_permission_overrides_select_own_or_admin" ON "public"."user_permission_overrides" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR ( SELECT "public"."current_user_has_permission"('admin.manage_users'::"text") AS "current_user_has_permission")));

ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_admin_delete" ON "public"."user_roles" FOR DELETE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_users'::"text") AS "current_user_has_permission"));

CREATE POLICY "user_roles_admin_insert" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_users'::"text") AS "current_user_has_permission"));

CREATE POLICY "user_roles_admin_update" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING (( SELECT "public"."current_user_has_permission"('admin.manage_users'::"text") AS "current_user_has_permission")) WITH CHECK (( SELECT "public"."current_user_has_permission"('admin.manage_users'::"text") AS "current_user_has_permission"));

CREATE POLICY "user_roles_select_own_or_admin" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR ( SELECT "public"."current_user_has_permission"('admin.manage_users'::"text") AS "current_user_has_permission")));

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_insert_own" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") = "id")));

CREATE POLICY "users_select_own_or_admin" ON "public"."users" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") OR ( SELECT "public"."current_user_has_permission"('admin.manage_users'::"text") AS "current_user_has_permission")));

CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") = "id"))) WITH CHECK ((( SELECT "public"."current_user_is_active"() AS "current_user_is_active") AND (( SELECT "auth"."uid"() AS "uid") = "id")));

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

REVOKE ALL ON FUNCTION "private"."ai_credit_usage_payload"("p_user_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."assert_all_published_show_presets"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."assert_published_presets_for_catalogue_item"("p_catalogue_item_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."assert_show_preset_publishable"("p_preset_id" "uuid", "p_is_published" boolean, "p_published_at" timestamp with time zone, "p_duration_seconds" integer, "p_preview_cues" "jsonb") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."assert_show_timeline_after_source_mutation"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."assert_show_timeline_for_catalogue_item"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."assert_show_timeline_for_firework"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."assert_show_timeline_for_multishot_shot"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."assert_show_timeline_non_overlapping"("p_show_ids" "uuid"[]) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."bump_effect_preview_images"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."bump_firework_preview_images"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."bump_multishot_preview_image"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."catalogue_item_occupied_launch_positions"("p_catalogue_item_id" "uuid", "p_parent_launch_position_index" integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."catalogue_item_safe_duration"("p_catalogue_item_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."create_assortment_public_link"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."enforce_multishot_minimum_duration"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."enforce_supported_song_analysis_source_licence"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."ensure_ai_credit_account"("p_user_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."ensure_ai_credit_account_for_user"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."ensure_firework_preview_image"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."firework_import_sha256"("p_value" "text") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."lock_show_timeline_sources_exclusive"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."lock_show_timeline_sources_shared"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."mark_firework_import_worker_claimed"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."multishot_minimum_duration"("p_multishot_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."raise_catalogue_multishot_duration"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."record_exhausted_song_analysis_dead_letter"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."reject_overlapping_show_timeline_item"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."reserve_assortment_ai_credit"("p_user_id" "uuid", "p_action_key" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_idempotency_key" "text", "p_metadata" "jsonb") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."resolve_firework_import_credit"("p_run_id" "uuid", "p_outcome" "text", "p_reason" "text") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."resolve_known_ai_credit"("p_user_id" "uuid", "p_reservation_key" "text", "p_reference_type" "text", "p_reference_id" "uuid", "p_outcome" "text", "p_reason" "text") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."resolve_song_analysis_credit"("p_analysis_id" "uuid", "p_outcome" "text", "p_reason" "text") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."show_launch_interval_seconds"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."show_preset_cue_catalogue_item_ids"("cues" "jsonb") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."sync_multishot_derived_state"("p_multishot_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."sync_multishot_derived_state_from_shot"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."sync_multishots_for_firework"("p_firework_id" "uuid") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."sync_multishots_from_catalogue_duration"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."sync_multishots_from_firework_duration"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."upsert_backend_dead_letter"("p_work_type" "text", "p_work_key" "text", "p_user_id" "uuid", "p_severity" "text", "p_reason" "text", "p_attempt_count" integer, "p_metadata" "jsonb") FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."validate_catalogue_timing_dependencies"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."validate_firework_timing_dependencies"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."validate_multishot_shot_timing_dependencies"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."validate_show_preset_publication"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."add_refinement_cue_and_settle_credits"("p_refinement_id" "uuid", "p_show_id" "uuid", "p_position" integer, "p_time_seconds" numeric, "p_catalogue_item_id" "uuid", "p_launch_position_index" integer, "p_emphasis" "text", "p_metadata" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."add_refinement_cue_and_settle_credits"("p_refinement_id" "uuid", "p_show_id" "uuid", "p_position" integer, "p_time_seconds" numeric, "p_catalogue_item_id" "uuid", "p_launch_position_index" integer, "p_emphasis" "text", "p_metadata" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."add_show_timeline_item"("p_show_id" "uuid", "p_time_seconds" numeric, "p_catalogue_item_id" "uuid", "p_launch_position_index" integer, "p_emphasis" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."add_show_timeline_item"("p_show_id" "uuid", "p_time_seconds" numeric, "p_catalogue_item_id" "uuid", "p_launch_position_index" integer, "p_emphasis" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."ai_credit_usage_payload"("p_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."ai_credit_usage_payload"("p_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."ai_credit_usage_payload"("p_user_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."append_firework_import_run_output"("p_run_id" "uuid", "p_lease_token" "uuid", "p_stage" "text", "p_sequence" integer, "p_output_type" "text", "p_schema_version" "text", "p_payload" "jsonb", "p_content_hash" "text", "p_storage_path" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."append_firework_import_run_output"("p_run_id" "uuid", "p_lease_token" "uuid", "p_stage" "text", "p_sequence" integer, "p_output_type" "text", "p_schema_version" "text", "p_payload" "jsonb", "p_content_hash" "text", "p_storage_path" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."approve_firework_import_candidate"("p_job_id" "uuid", "p_candidate_id" "uuid", "p_part_number" "text", "p_name" "text", "p_manufacturer" "text", "p_category" "text", "p_firework_type" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."approve_firework_import_candidate"("p_job_id" "uuid", "p_candidate_id" "uuid", "p_part_number" "text", "p_name" "text", "p_manufacturer" "text", "p_category" "text", "p_firework_type" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."approve_firework_import_candidate"("p_job_id" "uuid", "p_candidate_id" "uuid", "p_part_number" "text", "p_name" "text", "p_manufacturer" "text", "p_category" "text", "p_firework_type" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."archive_firework_import_job"("p_job_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."archive_firework_import_job"("p_job_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."archive_firework_import_job"("p_job_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."begin_firework_import_dispatch"("p_run_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."begin_firework_import_dispatch"("p_run_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."block_linked_catalogue_item_delete"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."block_linked_catalogue_item_delete"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."check_firework_import_dispatch_ready"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."check_firework_import_dispatch_ready"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."claim_cue_generation_attempt"("p_show_id" "uuid", "p_lease_seconds" integer, "p_max_attempts" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."claim_cue_generation_attempt"("p_show_id" "uuid", "p_lease_seconds" integer, "p_max_attempts" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."claim_cue_generation_attempt"("p_show_id" "uuid", "p_lease_seconds" integer, "p_max_attempts" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."claim_firework_import_run"("p_processor_version" "text", "p_requested_run_id" "uuid", "p_lease_seconds" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."claim_firework_import_run"("p_processor_version" "text", "p_requested_run_id" "uuid", "p_lease_seconds" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."claim_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_seconds" integer, "p_max_attempts" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."claim_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_seconds" integer, "p_max_attempts" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."claim_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_seconds" integer, "p_max_attempts" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."complete_cue_generation_attempt"("p_show_id" "uuid", "p_lease_token" "uuid", "p_cue_count" integer, "p_runtime_ms" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."complete_cue_generation_attempt"("p_show_id" "uuid", "p_lease_token" "uuid", "p_cue_count" integer, "p_runtime_ms" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."complete_cue_generation_attempt"("p_show_id" "uuid", "p_lease_token" "uuid", "p_cue_count" integer, "p_runtime_ms" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."complete_firework_import_run"("p_run_id" "uuid", "p_lease_token" "uuid", "p_candidates" "jsonb", "p_selected_ordinal" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."complete_firework_import_run"("p_run_id" "uuid", "p_lease_token" "uuid", "p_candidates" "jsonb", "p_selected_ordinal" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."complete_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_analysis_json" "jsonb", "p_markdown" "text", "p_schema_version" "text", "p_runner_version" "text", "p_runtime_ms" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."complete_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_analysis_json" "jsonb", "p_markdown" "text", "p_schema_version" "text", "p_runner_version" "text", "p_runtime_ms" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."complete_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_analysis_json" "jsonb", "p_markdown" "text", "p_schema_version" "text", "p_runner_version" "text", "p_runtime_ms" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_assortment_qr_show"("p_assortment_token" "text", "p_selection_id" "uuid", "p_public_access_token_hash" "text", "p_title" "text", "p_generation_mode" "text", "p_selected_cue_model" "text", "p_credit_action_key" "text", "p_cover_shader" "jsonb", "p_source_show_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_assortment_qr_show"("p_assortment_token" "text", "p_selection_id" "uuid", "p_public_access_token_hash" "text", "p_title" "text", "p_generation_mode" "text", "p_selected_cue_model" "text", "p_credit_action_key" "text", "p_cover_shader" "jsonb", "p_source_show_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_style_default_and_update_effect"("p_effect_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_effect_name" "text", "p_effect_description" "text", "p_pattern_key" "text", "p_sort_order" integer, "p_model_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_style_default_and_update_effect"("p_effect_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_effect_name" "text", "p_effect_description" "text", "p_pattern_key" "text", "p_sort_order" integer, "p_model_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_style_default_and_update_effect"("p_effect_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_effect_name" "text", "p_effect_description" "text", "p_pattern_key" "text", "p_sort_order" integer, "p_model_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_style_default_and_update_firework"("p_firework_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_firework_name" "text", "p_firework_description" "text", "p_firework_effect_id" "uuid", "p_caliber" "text", "p_duration_seconds" numeric, "p_height_meters" numeric, "p_primary_color" "text", "p_secondary_color" "text", "p_color_palette" "text"[], "p_render_overrides_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_style_default_and_update_firework"("p_firework_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_firework_name" "text", "p_firework_description" "text", "p_firework_effect_id" "uuid", "p_caliber" "text", "p_duration_seconds" numeric, "p_height_meters" numeric, "p_primary_color" "text", "p_secondary_color" "text", "p_color_palette" "text"[], "p_render_overrides_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_style_default_and_update_firework"("p_firework_id" "uuid", "p_expected_updated_at" timestamp with time zone, "p_firework_name" "text", "p_firework_description" "text", "p_firework_effect_id" "uuid", "p_caliber" "text", "p_duration_seconds" numeric, "p_height_meters" numeric, "p_primary_color" "text", "p_secondary_color" "text", "p_color_palette" "text"[], "p_render_overrides_json" "jsonb", "p_style_slug" "text", "p_style_name" "text", "p_style_description" "text", "p_style_kind" "text", "p_style_defaults_json" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."current_firework_import_render_validator_version"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."current_firework_import_render_validator_version"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."current_firework_import_renderer_contract_version"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."current_firework_import_renderer_contract_version"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."current_firework_import_validator_version"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."current_firework_import_validator_version"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."current_user_access"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."current_user_access"() TO "service_role";

GRANT ALL ON FUNCTION "public"."current_user_access"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."current_user_has_permission"("permission_key" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."current_user_has_permission"("permission_key" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."current_user_is_active"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."current_user_is_active"() TO "service_role";

GRANT ALL ON FUNCTION "public"."current_user_is_active"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."delete_show_timeline_item"("p_cue_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."delete_show_timeline_item"("p_cue_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."discard_unused_song_analysis"("p_analysis_id" "uuid", "p_audio_path" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."discard_unused_song_analysis"("p_analysis_id" "uuid", "p_audio_path" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."ensure_ai_credit_account"("p_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."ensure_ai_credit_account"("p_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."ensure_ai_credit_account"("p_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."ensure_assortment_public_link"("p_assortment_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."ensure_assortment_public_link"("p_assortment_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."ensure_catalogue_item_for_firework"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."ensure_catalogue_item_for_firework"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."ensure_catalogue_item_for_multishot"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."ensure_catalogue_item_for_multishot"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."expire_exhausted_cue_generations"("p_limit" integer, "p_max_attempts" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."expire_exhausted_cue_generations"("p_limit" integer, "p_max_attempts" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."expire_exhausted_song_analyses"("p_limit" integer, "p_max_attempts" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."expire_exhausted_song_analyses"("p_limit" integer, "p_max_attempts" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."fail_cue_generation_attempt"("p_show_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_dead_letter" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."fail_cue_generation_attempt"("p_show_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_dead_letter" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."fail_cue_generation_attempt"("p_show_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_dead_letter" boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."fail_firework_import_run"("p_run_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."fail_firework_import_run"("p_run_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."fail_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."fail_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."fail_song_analysis_attempt"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."fail_waiting_show_generation"("p_show_id" "uuid", "p_error_message" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."fail_waiting_show_generation"("p_show_id" "uuid", "p_error_message" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."fail_waiting_show_generation"("p_show_id" "uuid", "p_error_message" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."finalise_firework_video_import"("p_source_name" "text", "p_storage_path" "text", "p_original_name" "text", "p_selected_model" "text", "p_reported_duration_seconds" numeric) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."finalise_firework_video_import"("p_source_name" "text", "p_storage_path" "text", "p_original_name" "text", "p_selected_model" "text", "p_reported_duration_seconds" numeric) TO "service_role";

GRANT ALL ON FUNCTION "public"."finalise_firework_video_import"("p_source_name" "text", "p_storage_path" "text", "p_original_name" "text", "p_selected_model" "text", "p_reported_duration_seconds" numeric) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_backend_lifecycle_health"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."get_backend_lifecycle_health"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."grant_ai_credits"("p_user_id" "uuid", "p_amount" integer, "p_note" "text", "p_idempotency_key" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."grant_ai_credits"("p_user_id" "uuid", "p_amount" integer, "p_note" "text", "p_idempotency_key" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."grant_ai_credits"("p_user_id" "uuid", "p_amount" integer, "p_note" "text", "p_idempotency_key" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."has_permission"("target_user_id" "uuid", "permission_key" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."has_permission"("target_user_id" "uuid", "permission_key" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."heartbeat_firework_import_run"("p_run_id" "uuid", "p_lease_token" "uuid", "p_stage" "text", "p_progress" integer, "p_lease_seconds" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."heartbeat_firework_import_run"("p_run_id" "uuid", "p_lease_token" "uuid", "p_stage" "text", "p_progress" integer, "p_lease_seconds" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."list_orphan_audio_objects"("p_limit" integer, "p_grace_hours" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."list_orphan_audio_objects"("p_limit" integer, "p_grace_hours" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."lock_firework_import_lease"("p_run_id" "uuid", "p_lease_token" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."lock_firework_import_lease"("p_run_id" "uuid", "p_lease_token" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."prepare_assortment_jamendo_selection"("p_assortment_token" "text", "p_selection_id" "uuid", "p_access_token_hash" "text", "p_audio_path" "text", "p_original_filename" "text", "p_content_type" "text", "p_size_bytes" bigint, "p_new_analysis_id" "uuid", "p_source_track_id" "text", "p_source_title" "text", "p_source_artist" "text", "p_source_url" "text", "p_source_licence_name" "text", "p_source_licence_url" "text", "p_reusable_analysis_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."prepare_assortment_jamendo_selection"("p_assortment_token" "text", "p_selection_id" "uuid", "p_access_token_hash" "text", "p_audio_path" "text", "p_original_filename" "text", "p_content_type" "text", "p_size_bytes" bigint, "p_new_analysis_id" "uuid", "p_source_track_id" "text", "p_source_title" "text", "p_source_artist" "text", "p_source_url" "text", "p_source_licence_name" "text", "p_source_licence_url" "text", "p_reusable_analysis_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."prepare_assortment_song_analysis"("p_assortment_token" "text", "p_selection_id" "uuid", "p_analysis_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."prepare_assortment_song_analysis"("p_assortment_token" "text", "p_selection_id" "uuid", "p_analysis_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."purge_expired_song_analyses"("p_limit" integer, "p_retention_days" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."purge_expired_song_analyses"("p_limit" integer, "p_retention_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_backend_dead_letter"("p_work_type" "text", "p_work_key" "text", "p_user_id" "uuid", "p_severity" "text", "p_reason" "text", "p_attempt_count" integer, "p_metadata" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."record_backend_dead_letter"("p_work_type" "text", "p_work_key" "text", "p_user_id" "uuid", "p_severity" "text", "p_reason" "text", "p_attempt_count" integer, "p_metadata" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_firework_import_dispatch_result"("p_run_id" "uuid", "p_outcome" "text", "p_attempt_count" integer, "p_call_id" "text", "p_error" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."record_firework_import_dispatch_result"("p_run_id" "uuid", "p_outcome" "text", "p_attempt_count" integer, "p_call_id" "text", "p_error" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_firework_import_media_probe"("p_run_id" "uuid", "p_lease_token" "uuid", "p_duration_seconds" numeric, "p_width" integer, "p_height" integer, "p_source_probe" "jsonb", "p_normalized_preview" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."record_firework_import_media_probe"("p_run_id" "uuid", "p_lease_token" "uuid", "p_duration_seconds" numeric, "p_width" integer, "p_height" integer, "p_source_probe" "jsonb", "p_normalized_preview" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_firework_import_run_context"("p_run_id" "uuid", "p_lease_token" "uuid", "p_source_sha256" "text", "p_pipeline_version" "text", "p_engine_schema_version" "text", "p_video_model" "text", "p_prompt_snapshot" "jsonb", "p_model_snapshot" "jsonb", "p_modal_call_id" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."record_firework_import_run_context"("p_run_id" "uuid", "p_lease_token" "uuid", "p_source_sha256" "text", "p_pipeline_version" "text", "p_engine_schema_version" "text", "p_video_model" "text", "p_prompt_snapshot" "jsonb", "p_model_snapshot" "jsonb", "p_modal_call_id" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."refund_ai_credit_reservation"("p_user_id" "uuid", "p_reservation_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."refund_ai_credit_reservation"("p_user_id" "uuid", "p_reservation_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."replace_show_timeline_items"("p_show_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."replace_show_timeline_items"("p_show_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."replace_show_timeline_items"("p_show_id" "uuid", "p_user_id" "uuid", "p_items" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reserve_ai_credits"("p_user_id" "uuid", "p_action_key" "text", "p_amount" integer, "p_reference_type" "text", "p_reference_id" "uuid", "p_idempotency_key" "text", "p_metadata" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."reserve_ai_credits"("p_user_id" "uuid", "p_action_key" "text", "p_amount" integer, "p_reference_type" "text", "p_reference_id" "uuid", "p_idempotency_key" "text", "p_metadata" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."resolve_backend_dead_letter"("p_dead_letter_id" "uuid", "p_status" "text", "p_resolution_note" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."resolve_backend_dead_letter"("p_dead_letter_id" "uuid", "p_status" "text", "p_resolution_note" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."resolve_reconciled_show_generation_credit"("p_show_id" "uuid", "p_outcome" "text", "p_reason" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."resolve_reconciled_show_generation_credit"("p_show_id" "uuid", "p_outcome" "text", "p_reason" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."schedule_cue_generation_retry"("p_show_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_retry_delay_seconds" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."schedule_cue_generation_retry"("p_show_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_retry_delay_seconds" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."schedule_cue_generation_retry"("p_show_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_retry_delay_seconds" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."schedule_song_analysis_retry"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_retry_delay_seconds" integer) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."schedule_song_analysis_retry"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_retry_delay_seconds" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."schedule_song_analysis_retry"("p_analysis_id" "uuid", "p_lease_token" "uuid", "p_error_message" "text", "p_runtime_ms" integer, "p_retry_delay_seconds" integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."seal_firework_import_candidate"("p_candidate_id" "uuid", "p_validator_version" "text", "p_canonical_reconstruction" "jsonb", "p_content_hash" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."seal_firework_import_candidate"("p_candidate_id" "uuid", "p_validator_version" "text", "p_canonical_reconstruction" "jsonb", "p_content_hash" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."seal_firework_import_render_validation"("p_candidate_id" "uuid", "p_validator_version" "text", "p_canonical_evidence" "jsonb", "p_artifact_storage_path" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."seal_firework_import_render_validation"("p_candidate_id" "uuid", "p_validator_version" "text", "p_canonical_evidence" "jsonb", "p_artifact_storage_path" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."select_firework_import_candidate"("p_job_id" "uuid", "p_candidate_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."select_firework_import_candidate"("p_job_id" "uuid", "p_candidate_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."select_firework_import_candidate"("p_job_id" "uuid", "p_candidate_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_user_permission_overrides"("p_user_id" "uuid", "p_overrides" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_user_permission_overrides"("p_user_id" "uuid", "p_overrides" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_user_status"("p_user_id" "uuid", "p_status" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_user_status"("p_user_id" "uuid", "p_status" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."settle_ai_credit_reservation"("p_user_id" "uuid", "p_reservation_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."settle_ai_credit_reservation"("p_user_id" "uuid", "p_reservation_key" "text", "p_idempotency_key" "text", "p_metadata" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."show_preset_composition_signature"("p_preview_cues" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."show_preset_composition_signature"("p_preview_cues" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."show_preset_composition_signature"("p_preview_cues" "jsonb") TO "authenticated";

GRANT SELECT,MAINTAIN ON TABLE "public"."import_runs" TO "service_role";

GRANT SELECT ON TABLE "public"."import_runs" TO "authenticated";

REVOKE ALL ON FUNCTION "public"."start_firework_import_run"("p_job_id" "uuid", "p_request_kind" "text", "p_selected_model" "text", "p_idempotency_key" "text", "p_request_prompt" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."start_firework_import_run"("p_job_id" "uuid", "p_request_kind" "text", "p_selected_model" "text", "p_idempotency_key" "text", "p_request_prompt" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."start_firework_import_run"("p_job_id" "uuid", "p_request_kind" "text", "p_selected_model" "text", "p_idempotency_key" "text", "p_request_prompt" "text") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."sync_multishot_derived_state"("p_multishot_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."sync_multishot_derived_state"("p_multishot_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."sync_multishot_derived_state"("p_multishot_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."sync_show_preset_like_count"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."sync_show_preset_like_count"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."toggle_show_preset_like"("p_show_preset_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."toggle_show_preset_like"("p_show_preset_id" "uuid") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."update_prompt_config_atomically"("p_key" "text", "p_system_prompt_text" "text", "p_product_context_text" "text", "p_product_catalogue_fields" "jsonb") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."update_prompt_config_atomically"("p_key" "text", "p_system_prompt_text" "text", "p_product_context_text" "text", "p_product_catalogue_fields" "jsonb") TO "authenticated";

REVOKE ALL ON FUNCTION "public"."update_show_generation_mode"("p_generation_mode" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."update_show_generation_mode"("p_generation_mode" "text") TO "authenticated";

GRANT ALL ON TABLE "public"."ai_credit_accounts" TO "service_role";

GRANT SELECT ON TABLE "public"."ai_credit_accounts" TO "authenticated";

GRANT ALL ON TABLE "public"."ai_credit_costs" TO "service_role";

GRANT SELECT ON TABLE "public"."ai_credit_costs" TO "authenticated";

GRANT ALL ON TABLE "public"."ai_credit_transactions" TO "service_role";

GRANT SELECT ON TABLE "public"."ai_credit_transactions" TO "authenticated";

GRANT ALL ON TABLE "public"."assortment_items" TO "service_role";

GRANT SELECT ON TABLE "public"."assortment_items" TO "anon";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."assortment_items" TO "authenticated";

GRANT ALL ON TABLE "public"."assortment_public_links" TO "service_role";

GRANT SELECT ON TABLE "public"."assortment_public_links" TO "authenticated";

GRANT ALL ON TABLE "public"."assortment_song_selections" TO "service_role";

GRANT SELECT ON TABLE "public"."assortment_song_selections" TO "authenticated";

GRANT ALL ON TABLE "public"."assortments" TO "service_role";

GRANT SELECT ON TABLE "public"."assortments" TO "anon";

GRANT SELECT,INSERT,UPDATE ON TABLE "public"."assortments" TO "authenticated";

GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."backend_dead_letters" TO "service_role";

GRANT ALL ON TABLE "public"."catalogue_items" TO "service_role";

GRANT SELECT ON TABLE "public"."catalogue_items" TO "anon";

GRANT SELECT,INSERT,UPDATE ON TABLE "public"."catalogue_items" TO "authenticated";

GRANT ALL ON TABLE "public"."firework_editor_versions" TO "service_role";

GRANT SELECT,INSERT ON TABLE "public"."firework_editor_versions" TO "authenticated";

GRANT ALL ON TABLE "public"."firework_effects" TO "service_role";

GRANT SELECT ON TABLE "public"."firework_effects" TO "anon";

GRANT SELECT,INSERT,UPDATE ON TABLE "public"."firework_effects" TO "authenticated";

GRANT ALL ON TABLE "public"."firework_preview_images" TO "service_role";

GRANT SELECT ON TABLE "public"."firework_preview_images" TO "anon";

GRANT SELECT ON TABLE "public"."firework_preview_images" TO "authenticated";

GRANT ALL ON TABLE "public"."firework_style_defaults" TO "service_role";

GRANT SELECT,INSERT,UPDATE ON TABLE "public"."firework_style_defaults" TO "authenticated";

GRANT ALL ON TABLE "public"."fireworks" TO "service_role";

GRANT SELECT ON TABLE "public"."fireworks" TO "anon";

GRANT SELECT,INSERT,UPDATE ON TABLE "public"."fireworks" TO "authenticated";

GRANT ALL ON TABLE "public"."generation_settings" TO "service_role";

GRANT SELECT ON TABLE "public"."generation_settings" TO "authenticated";

GRANT ALL ON TABLE "public"."impersonation_sessions" TO "service_role";

GRANT SELECT,MAINTAIN ON TABLE "public"."import_candidate_render_validations" TO "service_role";

GRANT SELECT ON TABLE "public"."import_candidate_render_validations" TO "authenticated";

GRANT SELECT,MAINTAIN ON TABLE "public"."import_candidate_validations" TO "service_role";

GRANT SELECT ON TABLE "public"."import_candidate_validations" TO "authenticated";

GRANT SELECT,MAINTAIN ON TABLE "public"."import_candidates" TO "service_role";

GRANT SELECT ON TABLE "public"."import_candidates" TO "authenticated";

GRANT ALL ON TABLE "public"."import_jobs" TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."import_jobs" TO "authenticated";

GRANT ALL ON TABLE "public"."import_outputs" TO "service_role";

GRANT SELECT,INSERT ON TABLE "public"."import_outputs" TO "authenticated";

GRANT SELECT,MAINTAIN ON TABLE "public"."import_run_outputs" TO "service_role";

GRANT SELECT ON TABLE "public"."import_run_outputs" TO "authenticated";

GRANT ALL ON TABLE "public"."jamendo_response_cache" TO "service_role";

GRANT ALL ON TABLE "public"."media_assets" TO "service_role";

GRANT SELECT,INSERT ON TABLE "public"."media_assets" TO "authenticated";

GRANT ALL ON TABLE "public"."multishot_fireworks" TO "service_role";

GRANT SELECT ON TABLE "public"."multishot_fireworks" TO "anon";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."multishot_fireworks" TO "authenticated";

GRANT ALL ON TABLE "public"."multishots" TO "service_role";

GRANT SELECT ON TABLE "public"."multishots" TO "anon";

GRANT SELECT,INSERT,UPDATE ON TABLE "public"."multishots" TO "authenticated";

GRANT ALL ON TABLE "public"."permissions" TO "service_role";

GRANT SELECT ON TABLE "public"."permissions" TO "authenticated";

GRANT ALL ON TABLE "public"."prompt_configs" TO "service_role";

GRANT SELECT ON TABLE "public"."prompt_configs" TO "authenticated";

GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."role_permissions" TO "authenticated";

GRANT ALL ON TABLE "public"."roles" TO "service_role";

GRANT SELECT ON TABLE "public"."roles" TO "authenticated";

GRANT ALL ON TABLE "public"."show_assortment_items" TO "service_role";

GRANT SELECT ON TABLE "public"."show_assortment_items" TO "authenticated";

GRANT ALL ON TABLE "public"."show_assortment_selections" TO "service_role";

GRANT SELECT,INSERT,DELETE ON TABLE "public"."show_assortment_selections" TO "authenticated";

GRANT ALL ON TABLE "public"."show_generation_runs" TO "service_role";

GRANT SELECT,INSERT,UPDATE ON TABLE "public"."show_generation_runs" TO "authenticated";

GRANT ALL ON TABLE "public"."show_preset_like_counts" TO "service_role";

GRANT SELECT ON TABLE "public"."show_preset_like_counts" TO "anon";

GRANT SELECT ON TABLE "public"."show_preset_like_counts" TO "authenticated";

GRANT ALL ON TABLE "public"."show_preset_likes" TO "service_role";

GRANT SELECT ON TABLE "public"."show_preset_likes" TO "authenticated";

GRANT ALL ON TABLE "public"."show_presets" TO "service_role";

GRANT SELECT,INSERT,UPDATE ON TABLE "public"."show_presets" TO "authenticated";

GRANT SELECT("id") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("slug") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("title") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("theme") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("description") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("duration_seconds") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("budget_cents") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("total_cents") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("effects_count") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("time_of_day") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("mood_tags") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("preview_cues") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("is_featured") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("sort_order") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("created_at") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("updated_at") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("cover_shader") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("cover_image_path") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("is_published") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("published_at") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("composition_signature") ON TABLE "public"."show_presets" TO "anon";

GRANT SELECT("composition_signature") ON TABLE "public"."show_presets" TO "authenticated";

GRANT ALL ON TABLE "public"."show_timeline_items" TO "service_role";

GRANT SELECT ON TABLE "public"."show_timeline_items" TO "authenticated";

GRANT ALL ON TABLE "public"."shows" TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."shows" TO "authenticated";

GRANT ALL ON TABLE "public"."song_analyses" TO "service_role";

GRANT SELECT,INSERT ON TABLE "public"."song_analyses" TO "authenticated";

GRANT ALL ON TABLE "public"."supplier_inventory_items" TO "service_role";

GRANT SELECT ON TABLE "public"."supplier_inventory_items" TO "authenticated";

GRANT SELECT("id") ON TABLE "public"."supplier_inventory_items" TO "anon";

GRANT SELECT("price_cents") ON TABLE "public"."supplier_inventory_items" TO "anon";

GRANT SELECT("currency") ON TABLE "public"."supplier_inventory_items" TO "anon";

GRANT SELECT("available") ON TABLE "public"."supplier_inventory_items" TO "anon";

GRANT SELECT("catalogue_item_id") ON TABLE "public"."supplier_inventory_items" TO "anon";

GRANT ALL ON TABLE "public"."supplier_profiles" TO "service_role";

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."supplier_profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."user_permission_overrides" TO "service_role";

GRANT SELECT ON TABLE "public"."user_permission_overrides" TO "authenticated";

GRANT ALL ON TABLE "public"."user_roles" TO "service_role";

GRANT SELECT,INSERT,UPDATE ON TABLE "public"."user_roles" TO "authenticated";

GRANT ALL ON TABLE "public"."users" TO "service_role";

GRANT SELECT ON TABLE "public"."users" TO "authenticated";

GRANT UPDATE("full_name") ON TABLE "public"."users" TO "authenticated";

GRANT UPDATE("phone") ON TABLE "public"."users" TO "authenticated";

GRANT UPDATE("theme_preference") ON TABLE "public"."users" TO "authenticated";

