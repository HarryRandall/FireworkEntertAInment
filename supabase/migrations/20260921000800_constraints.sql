-- ShowCrafter baseline: constraints.
set check_function_bodies = false;

ALTER TABLE ONLY "public"."ai_credit_accounts"
    ADD CONSTRAINT "ai_credit_accounts_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."ai_credit_costs"
    ADD CONSTRAINT "ai_credit_costs_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."ai_credit_transactions"
    ADD CONSTRAINT "ai_credit_transactions_idempotency_key_key" UNIQUE ("idempotency_key");

ALTER TABLE ONLY "public"."ai_credit_transactions"
    ADD CONSTRAINT "ai_credit_transactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."assortment_items"
    ADD CONSTRAINT "assortment_items_assortment_id_catalogue_item_id_key" UNIQUE ("assortment_id", "catalogue_item_id");

ALTER TABLE ONLY "public"."assortment_items"
    ADD CONSTRAINT "assortment_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."assortment_public_links"
    ADD CONSTRAINT "assortment_public_links_pkey" PRIMARY KEY ("assortment_id");

ALTER TABLE ONLY "public"."assortment_public_links"
    ADD CONSTRAINT "assortment_public_links_public_token_key" UNIQUE ("public_token");

ALTER TABLE ONLY "public"."assortment_song_selections"
    ADD CONSTRAINT "assortment_song_selections_access_token_hash_key" UNIQUE ("access_token_hash");

ALTER TABLE ONLY "public"."assortment_song_selections"
    ADD CONSTRAINT "assortment_song_selections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."assortments"
    ADD CONSTRAINT "assortments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."assortments"
    ADD CONSTRAINT "assortments_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."backend_dead_letters"
    ADD CONSTRAINT "backend_dead_letters_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."backend_dead_letters"
    ADD CONSTRAINT "backend_dead_letters_work_unique" UNIQUE ("work_type", "work_key");

ALTER TABLE ONLY "public"."catalogue_items"
    ADD CONSTRAINT "catalogue_items_multishot_id_key" UNIQUE ("multishot_id");

ALTER TABLE ONLY "public"."catalogue_items"
    ADD CONSTRAINT "catalogue_items_part_number_key" UNIQUE ("part_number");

ALTER TABLE ONLY "public"."catalogue_items"
    ADD CONSTRAINT "catalogue_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."firework_editor_versions"
    ADD CONSTRAINT "firework_editor_versions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."firework_effects"
    ADD CONSTRAINT "firework_effects_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."firework_effects"
    ADD CONSTRAINT "firework_effects_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."firework_preview_images"
    ADD CONSTRAINT "firework_preview_images_firework_effect_id_key" UNIQUE ("firework_effect_id");

ALTER TABLE ONLY "public"."firework_preview_images"
    ADD CONSTRAINT "firework_preview_images_firework_id_key" UNIQUE ("firework_id");

ALTER TABLE ONLY "public"."firework_preview_images"
    ADD CONSTRAINT "firework_preview_images_multishot_id_key" UNIQUE ("multishot_id");

ALTER TABLE ONLY "public"."firework_preview_images"
    ADD CONSTRAINT "firework_preview_images_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."firework_style_defaults"
    ADD CONSTRAINT "firework_style_defaults_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."firework_style_defaults"
    ADD CONSTRAINT "firework_style_defaults_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."fireworks"
    ADD CONSTRAINT "firework_variants_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."fireworks"
    ADD CONSTRAINT "firework_variants_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."generation_settings"
    ADD CONSTRAINT "generation_settings_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_return_token_hash_key" UNIQUE ("return_token_hash");

ALTER TABLE ONLY "public"."import_candidate_render_validations"
    ADD CONSTRAINT "import_candidate_render_validations_pkey" PRIMARY KEY ("candidate_id", "validator_version");

ALTER TABLE ONLY "public"."import_candidate_validations"
    ADD CONSTRAINT "import_candidate_validations_pkey" PRIMARY KEY ("candidate_id", "validator_version");

ALTER TABLE ONLY "public"."import_candidates"
    ADD CONSTRAINT "import_candidates_import_run_id_content_hash_key" UNIQUE ("import_run_id", "content_hash");

ALTER TABLE ONLY "public"."import_candidates"
    ADD CONSTRAINT "import_candidates_import_run_id_ordinal_key" UNIQUE ("import_run_id", "ordinal");

ALTER TABLE ONLY "public"."import_candidates"
    ADD CONSTRAINT "import_candidates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."import_outputs"
    ADD CONSTRAINT "import_outputs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."import_run_outputs"
    ADD CONSTRAINT "import_run_outputs_import_run_id_stage_sequence_key" UNIQUE ("import_run_id", "stage", "sequence");

ALTER TABLE ONLY "public"."import_run_outputs"
    ADD CONSTRAINT "import_run_outputs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."import_runs"
    ADD CONSTRAINT "import_runs_idempotency_key_key" UNIQUE ("idempotency_key");

ALTER TABLE ONLY "public"."import_runs"
    ADD CONSTRAINT "import_runs_import_job_id_attempt_number_key" UNIQUE ("import_job_id", "attempt_number");

ALTER TABLE ONLY "public"."import_runs"
    ADD CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."jamendo_response_cache"
    ADD CONSTRAINT "jamendo_response_cache_pkey" PRIMARY KEY ("cache_key");

ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."multishot_fireworks"
    ADD CONSTRAINT "multishot_fireworks_multishot_id_sequence_index_key" UNIQUE ("multishot_id", "sequence_index");

ALTER TABLE ONLY "public"."multishot_fireworks"
    ADD CONSTRAINT "multishot_fireworks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."multishots"
    ADD CONSTRAINT "multishots_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."multishots"
    ADD CONSTRAINT "multishots_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."song_analyses"
    ADD CONSTRAINT "music_analyses_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_key_key" UNIQUE ("key");

ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."prompt_configs"
    ADD CONSTRAINT "prompt_configs_pkey" PRIMARY KEY ("key");

ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_key_key" UNIQUE ("key");

ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."show_generation_runs"
    ADD CONSTRAINT "show_analyses_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."show_assortment_items"
    ADD CONSTRAINT "show_assortment_items_pkey" PRIMARY KEY ("show_id", "catalogue_item_id");

ALTER TABLE ONLY "public"."show_assortment_selections"
    ADD CONSTRAINT "show_assortment_selections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."show_assortment_selections"
    ADD CONSTRAINT "show_assortment_selections_show_id_assortment_id_key" UNIQUE ("show_id", "assortment_id");

ALTER TABLE ONLY "public"."show_timeline_items"
    ADD CONSTRAINT "show_cues_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."show_preset_like_counts"
    ADD CONSTRAINT "show_preset_like_counts_pkey" PRIMARY KEY ("show_preset_id");

ALTER TABLE ONLY "public"."show_preset_likes"
    ADD CONSTRAINT "show_preset_likes_pkey" PRIMARY KEY ("show_preset_id", "user_id");

ALTER TABLE ONLY "public"."show_presets"
    ADD CONSTRAINT "show_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."show_presets"
    ADD CONSTRAINT "show_templates_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."show_timeline_items"
    ADD CONSTRAINT "show_timeline_items_show_id_position_key" UNIQUE ("show_id", "position");

ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_user_id_slug_key" UNIQUE ("user_id", "slug");

ALTER TABLE ONLY "public"."supplier_inventory_items"
    ADD CONSTRAINT "supplier_inventory_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."supplier_inventory_items"
    ADD CONSTRAINT "supplier_inventory_items_supplier_catalogue_item_unique" UNIQUE ("supplier_id", "catalogue_item_id");

ALTER TABLE ONLY "public"."supplier_profiles"
    ADD CONSTRAINT "supplier_profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."supplier_profiles"
    ADD CONSTRAINT "supplier_profiles_slug_key" UNIQUE ("slug");

ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("user_id", "permission_id");

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id");

CREATE INDEX "ai_credit_costs_updated_by_idx" ON "public"."ai_credit_costs" USING "btree" ("updated_by") WHERE ("updated_by" IS NOT NULL);

CREATE INDEX "ai_credit_transactions_created_by_idx" ON "public"."ai_credit_transactions" USING "btree" ("created_by") WHERE ("created_by" IS NOT NULL);

CREATE INDEX "ai_credit_transactions_reference_idx" ON "public"."ai_credit_transactions" USING "btree" ("reference_type", "reference_id") WHERE (("reference_type" IS NOT NULL) AND ("reference_id" IS NOT NULL));

CREATE INDEX "ai_credit_transactions_related_idx" ON "public"."ai_credit_transactions" USING "btree" ("related_transaction_id") WHERE ("related_transaction_id" IS NOT NULL);

CREATE INDEX "ai_credit_transactions_user_created_idx" ON "public"."ai_credit_transactions" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "ai_credit_transactions_user_type_created_idx" ON "public"."ai_credit_transactions" USING "btree" ("user_id", "transaction_type", "created_at" DESC);

CREATE INDEX "assortment_items_assortment_id_idx" ON "public"."assortment_items" USING "btree" ("assortment_id", "sort_order");

CREATE INDEX "assortment_items_catalogue_item_id_idx" ON "public"."assortment_items" USING "btree" ("catalogue_item_id");

CREATE INDEX "assortment_public_links_funding_user_idx" ON "public"."assortment_public_links" USING "btree" ("funding_user_id");

CREATE INDEX "assortment_song_selections_assortment_created_idx" ON "public"."assortment_song_selections" USING "btree" ("assortment_id", "created_at" DESC);

CREATE INDEX "assortment_song_selections_audio_path_idx" ON "public"."assortment_song_selections" USING "btree" ("audio_path");

CREATE INDEX "assortment_song_selections_funding_user_idx" ON "public"."assortment_song_selections" USING "btree" ("funding_user_id");

CREATE INDEX "assortment_song_selections_music_analysis_idx" ON "public"."assortment_song_selections" USING "btree" ("music_analysis_id") WHERE ("music_analysis_id" IS NOT NULL);

CREATE INDEX "backend_dead_letters_open_last_observed_idx" ON "public"."backend_dead_letters" USING "btree" ("last_observed_at" DESC) WHERE ("status" = 'open'::"text");

CREATE INDEX "catalogue_items_firework_id_idx" ON "public"."catalogue_items" USING "btree" ("firework_id") WHERE ("firework_id" IS NOT NULL);

CREATE INDEX "catalogue_items_kind_name_idx" ON "public"."catalogue_items" USING "btree" ("catalogue_item_kind", "name");

CREATE INDEX "firework_editor_versions_created_by_idx" ON "public"."firework_editor_versions" USING "btree" ("created_by") WHERE ("created_by" IS NOT NULL);

CREATE INDEX "firework_editor_versions_effect_created_at_idx" ON "public"."firework_editor_versions" USING "btree" ("firework_effect_id", "created_at" DESC);

CREATE INDEX "firework_editor_versions_firework_created_at_idx" ON "public"."firework_editor_versions" USING "btree" ("firework_id", "created_at" DESC);

CREATE INDEX "firework_editor_versions_style_default_created_at_idx" ON "public"."firework_editor_versions" USING "btree" ("firework_style_default_id", "created_at" DESC);

CREATE INDEX "firework_style_defaults_kind_sort_idx" ON "public"."firework_style_defaults" USING "btree" ("kind", "is_archived", "sort_order", "name");

CREATE INDEX "firework_variants_effect_id_idx" ON "public"."fireworks" USING "btree" ("firework_effect_id");

CREATE INDEX "generation_settings_updated_by_idx" ON "public"."generation_settings" USING "btree" ("updated_by") WHERE ("updated_by" IS NOT NULL);

CREATE INDEX "impersonation_sessions_active_token_idx" ON "public"."impersonation_sessions" USING "btree" ("return_token_hash") WHERE ("ended_at" IS NULL);

CREATE INDEX "impersonation_sessions_admin_started_idx" ON "public"."impersonation_sessions" USING "btree" ("admin_user_id", "started_at" DESC);

CREATE INDEX "impersonation_sessions_target_started_idx" ON "public"."impersonation_sessions" USING "btree" ("target_user_id", "started_at" DESC);

CREATE INDEX "import_candidates_run_score_idx" ON "public"."import_candidates" USING "btree" ("import_run_id", "score" DESC, "ordinal");

CREATE INDEX "import_jobs_active_run_idx" ON "public"."import_jobs" USING "btree" ("active_run_id") WHERE ("active_run_id" IS NOT NULL);

CREATE INDEX "import_jobs_approved_catalogue_item_id_idx" ON "public"."import_jobs" USING "btree" ("approved_catalogue_item_id") WHERE ("approved_catalogue_item_id" IS NOT NULL);

CREATE INDEX "import_jobs_created_by_idx" ON "public"."import_jobs" USING "btree" ("created_by") WHERE ("created_by" IS NOT NULL);

CREATE INDEX "import_jobs_media_asset_id_idx" ON "public"."import_jobs" USING "btree" ("media_asset_id") WHERE ("media_asset_id" IS NOT NULL);

CREATE INDEX "import_jobs_status_idx" ON "public"."import_jobs" USING "btree" ("status", "created_at" DESC);

CREATE UNIQUE INDEX "import_jobs_video_media_asset_key" ON "public"."import_jobs" USING "btree" ("media_asset_id") WHERE (("kind" = 'firework_video'::"text") AND ("media_asset_id" IS NOT NULL));

CREATE INDEX "import_outputs_job_created_idx" ON "public"."import_outputs" USING "btree" ("import_job_id", "created_at");

CREATE INDEX "import_run_outputs_run_created_idx" ON "public"."import_run_outputs" USING "btree" ("import_run_id", "created_at");

CREATE INDEX "import_runs_job_created_idx" ON "public"."import_runs" USING "btree" ("import_job_id", "created_at" DESC);

CREATE INDEX "import_runs_queue_idx" ON "public"."import_runs" USING "btree" ("created_at") WHERE ("status" = 'queued'::"text");

CREATE INDEX "jamendo_response_cache_expires_at_idx" ON "public"."jamendo_response_cache" USING "btree" ("expires_at");

CREATE INDEX "media_assets_owner_id_idx" ON "public"."media_assets" USING "btree" ("owner_id") WHERE ("owner_id" IS NOT NULL);

CREATE UNIQUE INDEX "media_assets_storage_path_key" ON "public"."media_assets" USING "btree" ("storage_path") WHERE ("storage_path" IS NOT NULL);

CREATE INDEX "multishot_fireworks_firework_id_idx" ON "public"."multishot_fireworks" USING "btree" ("firework_id");

CREATE INDEX "music_analyses_audio_path_idx" ON "public"."song_analyses" USING "btree" ("audio_path");

CREATE INDEX "music_analyses_user_id_created_at_idx" ON "public"."song_analyses" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "prompt_configs_updated_by_idx" ON "public"."prompt_configs" USING "btree" ("updated_by") WHERE ("updated_by" IS NOT NULL);

CREATE INDEX "role_permissions_permission_id_idx" ON "public"."role_permissions" USING "btree" ("permission_id");

CREATE INDEX "show_analyses_show_id_created_at_idx" ON "public"."show_generation_runs" USING "btree" ("show_id", "created_at" DESC);

CREATE INDEX "show_analyses_user_id_created_at_idx" ON "public"."show_generation_runs" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "show_assortment_items_catalogue_item_idx" ON "public"."show_assortment_items" USING "btree" ("catalogue_item_id");

CREATE INDEX "show_assortment_selections_show_id_idx" ON "public"."show_assortment_selections" USING "btree" ("show_id");

CREATE INDEX "show_preset_likes_user_id_idx" ON "public"."show_preset_likes" USING "btree" ("user_id");

CREATE INDEX "show_presets_public_library_idx" ON "public"."show_presets" USING "btree" ("is_published" DESC, "is_featured" DESC, "sort_order", "title");

CREATE INDEX "show_presets_published_cue_catalogue_item_ids_idx" ON "public"."show_presets" USING "gin" ("private"."show_preset_cue_catalogue_item_ids"("preview_cues")) WHERE "is_published";

CREATE UNIQUE INDEX "show_presets_source_show_id_key" ON "public"."show_presets" USING "btree" ("source_show_id") WHERE ("source_show_id" IS NOT NULL);

CREATE INDEX "show_templates_featured_idx" ON "public"."show_presets" USING "btree" ("is_featured" DESC, "sort_order", "title");

CREATE INDEX "show_templates_updated_idx" ON "public"."show_presets" USING "btree" ("updated_at" DESC);

CREATE INDEX "show_timeline_items_catalogue_item_id_idx" ON "public"."show_timeline_items" USING "btree" ("catalogue_item_id") WHERE ("catalogue_item_id" IS NOT NULL);

CREATE INDEX "shows_assortment_id_idx" ON "public"."shows" USING "btree" ("assortment_id") WHERE ("assortment_id" IS NOT NULL);

CREATE INDEX "shows_assortment_song_selection_idx" ON "public"."shows" USING "btree" ("assortment_song_selection_id") WHERE ("assortment_song_selection_id" IS NOT NULL);

CREATE INDEX "shows_generation_retry_claim_idx" ON "public"."shows" USING "btree" (COALESCE("generation_next_retry_at", "generation_started_at", "created_at"), "generation_lease_expires_at", "created_at") WHERE ("generation_status" = 'running'::"text");

CREATE INDEX "shows_music_analysis_id_idx" ON "public"."shows" USING "btree" ("music_analysis_id");

CREATE UNIQUE INDEX "shows_public_access_token_hash_idx" ON "public"."shows" USING "btree" ("public_access_token_hash") WHERE ("public_access_token_hash" IS NOT NULL);

CREATE INDEX "shows_user_id_idx" ON "public"."shows" USING "btree" ("user_id", "updated_at" DESC);

CREATE INDEX "song_analyses_jamendo_reuse_idx" ON "public"."song_analyses" USING "btree" ("user_id", "source_track_id", "completed_at" DESC) WHERE (("source_provider" = 'jamendo'::"text") AND ("status" = 'completed'::"text") AND ("analysis_json" IS NOT NULL));

CREATE INDEX "song_analyses_retry_claim_idx" ON "public"."song_analyses" USING "btree" (COALESCE("next_retry_at", "created_at"), "lease_expires_at", "created_at") WHERE ("status" = 'running'::"text");

CREATE INDEX "supplier_inventory_items_catalogue_item_id_idx" ON "public"."supplier_inventory_items" USING "btree" ("catalogue_item_id") WHERE ("catalogue_item_id" IS NOT NULL);

CREATE INDEX "supplier_inventory_items_updated_by_idx" ON "public"."supplier_inventory_items" USING "btree" ("updated_by") WHERE ("updated_by" IS NOT NULL);

CREATE INDEX "supplier_inventory_supplier_id_idx" ON "public"."supplier_inventory_items" USING "btree" ("supplier_id", "available");

CREATE INDEX "user_permission_overrides_assigned_by_idx" ON "public"."user_permission_overrides" USING "btree" ("assigned_by") WHERE ("assigned_by" IS NOT NULL);

CREATE INDEX "user_permission_overrides_permission_id_idx" ON "public"."user_permission_overrides" USING "btree" ("permission_id");

CREATE INDEX "user_permission_overrides_user_id_idx" ON "public"."user_permission_overrides" USING "btree" ("user_id");

CREATE INDEX "user_roles_assigned_by_idx" ON "public"."user_roles" USING "btree" ("assigned_by") WHERE ("assigned_by" IS NOT NULL);

CREATE UNIQUE INDEX "user_roles_one_role_per_user_idx" ON "public"."user_roles" USING "btree" ("user_id");

CREATE INDEX "user_roles_role_id_idx" ON "public"."user_roles" USING "btree" ("role_id");

ALTER TABLE ONLY "public"."ai_credit_accounts"
    ADD CONSTRAINT "ai_credit_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ai_credit_costs"
    ADD CONSTRAINT "ai_credit_costs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ai_credit_transactions"
    ADD CONSTRAINT "ai_credit_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ai_credit_transactions"
    ADD CONSTRAINT "ai_credit_transactions_related_transaction_id_fkey" FOREIGN KEY ("related_transaction_id") REFERENCES "public"."ai_credit_transactions"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ai_credit_transactions"
    ADD CONSTRAINT "ai_credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."assortment_items"
    ADD CONSTRAINT "assortment_items_assortment_id_fkey" FOREIGN KEY ("assortment_id") REFERENCES "public"."assortments"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."assortment_items"
    ADD CONSTRAINT "assortment_items_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."assortment_public_links"
    ADD CONSTRAINT "assortment_public_links_assortment_id_fkey" FOREIGN KEY ("assortment_id") REFERENCES "public"."assortments"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."assortment_public_links"
    ADD CONSTRAINT "assortment_public_links_funding_user_id_fkey" FOREIGN KEY ("funding_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."assortment_song_selections"
    ADD CONSTRAINT "assortment_song_selections_assortment_id_fkey" FOREIGN KEY ("assortment_id") REFERENCES "public"."assortments"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."assortment_song_selections"
    ADD CONSTRAINT "assortment_song_selections_funding_user_id_fkey" FOREIGN KEY ("funding_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."assortment_song_selections"
    ADD CONSTRAINT "assortment_song_selections_music_analysis_id_fkey" FOREIGN KEY ("music_analysis_id") REFERENCES "public"."song_analyses"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."assortments"
    ADD CONSTRAINT "assortments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."backend_dead_letters"
    ADD CONSTRAINT "backend_dead_letters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."catalogue_items"
    ADD CONSTRAINT "catalogue_items_firework_id_fkey" FOREIGN KEY ("firework_id") REFERENCES "public"."fireworks"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."catalogue_items"
    ADD CONSTRAINT "catalogue_items_multishot_id_fkey" FOREIGN KEY ("multishot_id") REFERENCES "public"."multishots"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."firework_editor_versions"
    ADD CONSTRAINT "firework_editor_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."firework_editor_versions"
    ADD CONSTRAINT "firework_editor_versions_firework_effect_id_fkey" FOREIGN KEY ("firework_effect_id") REFERENCES "public"."firework_effects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."firework_editor_versions"
    ADD CONSTRAINT "firework_editor_versions_firework_id_fkey" FOREIGN KEY ("firework_id") REFERENCES "public"."fireworks"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."firework_editor_versions"
    ADD CONSTRAINT "firework_editor_versions_firework_style_default_id_fkey" FOREIGN KEY ("firework_style_default_id") REFERENCES "public"."firework_style_defaults"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."firework_preview_images"
    ADD CONSTRAINT "firework_preview_images_firework_effect_id_fkey" FOREIGN KEY ("firework_effect_id") REFERENCES "public"."firework_effects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."firework_preview_images"
    ADD CONSTRAINT "firework_preview_images_firework_id_fkey" FOREIGN KEY ("firework_id") REFERENCES "public"."fireworks"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."firework_preview_images"
    ADD CONSTRAINT "firework_preview_images_multishot_id_fkey" FOREIGN KEY ("multishot_id") REFERENCES "public"."multishots"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."fireworks"
    ADD CONSTRAINT "firework_variants_effect_id_fkey" FOREIGN KEY ("firework_effect_id") REFERENCES "public"."firework_effects"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."generation_settings"
    ADD CONSTRAINT "generation_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."impersonation_sessions"
    ADD CONSTRAINT "impersonation_sessions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."import_candidate_render_validations"
    ADD CONSTRAINT "import_candidate_render_validations_artifact_output_id_fkey" FOREIGN KEY ("artifact_output_id") REFERENCES "public"."import_run_outputs"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."import_candidate_render_validations"
    ADD CONSTRAINT "import_candidate_render_validations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."import_candidates"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."import_candidate_validations"
    ADD CONSTRAINT "import_candidate_validations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."import_candidates"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."import_candidates"
    ADD CONSTRAINT "import_candidates_import_run_id_fkey" FOREIGN KEY ("import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_active_run_id_fkey" FOREIGN KEY ("active_run_id") REFERENCES "public"."import_runs"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_approved_candidate_id_fkey" FOREIGN KEY ("approved_candidate_id") REFERENCES "public"."import_candidates"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_approved_catalogue_item_id_fkey" FOREIGN KEY ("approved_catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_approved_run_id_fkey" FOREIGN KEY ("approved_run_id") REFERENCES "public"."import_runs"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_selected_candidate_id_fkey" FOREIGN KEY ("selected_candidate_id") REFERENCES "public"."import_candidates"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."import_outputs"
    ADD CONSTRAINT "import_outputs_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."import_run_outputs"
    ADD CONSTRAINT "import_run_outputs_import_run_id_fkey" FOREIGN KEY ("import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."import_runs"
    ADD CONSTRAINT "import_runs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."import_runs"
    ADD CONSTRAINT "import_runs_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."import_runs"
    ADD CONSTRAINT "import_runs_parent_run_id_fkey" FOREIGN KEY ("parent_run_id") REFERENCES "public"."import_runs"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."import_runs"
    ADD CONSTRAINT "import_runs_source_candidate_id_fkey" FOREIGN KEY ("source_candidate_id") REFERENCES "public"."import_candidates"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."multishot_fireworks"
    ADD CONSTRAINT "multishot_fireworks_firework_id_fkey" FOREIGN KEY ("firework_id") REFERENCES "public"."fireworks"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."multishot_fireworks"
    ADD CONSTRAINT "multishot_fireworks_multishot_id_fkey" FOREIGN KEY ("multishot_id") REFERENCES "public"."multishots"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."song_analyses"
    ADD CONSTRAINT "music_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."prompt_configs"
    ADD CONSTRAINT "prompt_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."show_generation_runs"
    ADD CONSTRAINT "show_analyses_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."show_generation_runs"
    ADD CONSTRAINT "show_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."show_assortment_items"
    ADD CONSTRAINT "show_assortment_items_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."show_assortment_items"
    ADD CONSTRAINT "show_assortment_items_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."show_assortment_selections"
    ADD CONSTRAINT "show_assortment_selections_assortment_id_fkey" FOREIGN KEY ("assortment_id") REFERENCES "public"."assortments"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."show_assortment_selections"
    ADD CONSTRAINT "show_assortment_selections_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."show_timeline_items"
    ADD CONSTRAINT "show_cues_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."show_preset_like_counts"
    ADD CONSTRAINT "show_preset_like_counts_show_preset_id_fkey" FOREIGN KEY ("show_preset_id") REFERENCES "public"."show_presets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."show_preset_likes"
    ADD CONSTRAINT "show_preset_likes_show_preset_id_fkey" FOREIGN KEY ("show_preset_id") REFERENCES "public"."show_presets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."show_preset_likes"
    ADD CONSTRAINT "show_preset_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."show_presets"
    ADD CONSTRAINT "show_presets_source_show_id_fkey" FOREIGN KEY ("source_show_id") REFERENCES "public"."shows"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."show_timeline_items"
    ADD CONSTRAINT "show_timeline_items_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id");

ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_assortment_id_fkey" FOREIGN KEY ("assortment_id") REFERENCES "public"."assortments"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_assortment_song_selection_id_fkey" FOREIGN KEY ("assortment_song_selection_id") REFERENCES "public"."assortment_song_selections"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_music_analysis_id_fkey" FOREIGN KEY ("music_analysis_id") REFERENCES "public"."song_analyses"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."shows"
    ADD CONSTRAINT "shows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."supplier_inventory_items"
    ADD CONSTRAINT "supplier_inventory_items_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "public"."catalogue_items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."supplier_inventory_items"
    ADD CONSTRAINT "supplier_inventory_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier_profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."supplier_inventory_items"
    ADD CONSTRAINT "supplier_inventory_items_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
