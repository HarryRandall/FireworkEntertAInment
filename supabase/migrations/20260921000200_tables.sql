-- ShowCrafter baseline: tables.
set check_function_bodies = false;

CREATE TABLE IF NOT EXISTS "public"."import_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_job_id" "uuid" NOT NULL,
    "parent_run_id" "uuid",
    "created_by" "uuid",
    "request_kind" "text" NOT NULL,
    "request_prompt" "text",
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "stage" "text" DEFAULT 'queued'::"text" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "attempt_number" integer NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "source_sha256" "text",
    "pipeline_version" "text" DEFAULT 'firework-reconstruction-v4'::"text" NOT NULL,
    "engine_schema_version" "text" DEFAULT 'showcrafter.firework-design.v1'::"text" NOT NULL,
    "selected_model" "text" NOT NULL,
    "video_model" "text",
    "prompt_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "model_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "modal_call_id" "text",
    "lease_recovery_count" integer DEFAULT 0 NOT NULL,
    "completion_request_hash" "text",
    "completion_lease_token" "uuid",
    "failure_request_hash" "text",
    "failure_lease_token" "uuid",
    "credit_action_key" "text",
    "credit_reservation_key" "text",
    "credit_status" "text",
    "lease_token" "uuid",
    "lease_expires_at" timestamp with time zone,
    "heartbeat_at" timestamp with time zone,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_candidate_id" "uuid",
    "direct_dispatch_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "direct_dispatch_call_id" "text",
    "direct_dispatch_attempt_count" integer DEFAULT 0 NOT NULL,
    "direct_dispatch_error" "text",
    "direct_dispatch_updated_at" timestamp with time zone,
    CONSTRAINT "import_runs_attempt_number_check" CHECK (("attempt_number" > 0)),
    CONSTRAINT "import_runs_completion_request_hash" CHECK ((("completion_request_hash" IS NULL) OR ("completion_request_hash" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "import_runs_credit_action_key_check" CHECK ((("credit_action_key" IS NULL) OR ("credit_action_key" = ANY (ARRAY['import_video_reconstruction'::"text", 'import_video_refinement'::"text"])))),
    CONSTRAINT "import_runs_credit_status_check" CHECK ((("credit_status" IS NULL) OR ("credit_status" = ANY (ARRAY['reserved'::"text", 'settled'::"text", 'refunded'::"text"])))),
    CONSTRAINT "import_runs_direct_dispatch_attempt_count_check" CHECK ((("direct_dispatch_attempt_count" >= 0) AND ("direct_dispatch_attempt_count" <= 3))),
    CONSTRAINT "import_runs_direct_dispatch_call_id" CHECK ((("direct_dispatch_call_id" IS NULL) OR (("char_length"("btrim"("direct_dispatch_call_id")) >= 1) AND ("char_length"("btrim"("direct_dispatch_call_id")) <= 240)))),
    CONSTRAINT "import_runs_direct_dispatch_error" CHECK ((("direct_dispatch_error" IS NULL) OR (("char_length"("btrim"("direct_dispatch_error")) >= 1) AND ("char_length"("btrim"("direct_dispatch_error")) <= 1000)))),
    CONSTRAINT "import_runs_direct_dispatch_state" CHECK (((("direct_dispatch_status" = 'pending'::"text") AND ("direct_dispatch_call_id" IS NULL) AND ("direct_dispatch_attempt_count" = 0) AND ("direct_dispatch_error" IS NULL) AND ("direct_dispatch_updated_at" IS NULL)) OR (("direct_dispatch_status" = 'dispatching'::"text") AND ("direct_dispatch_call_id" IS NULL) AND ("direct_dispatch_attempt_count" = 0) AND ("direct_dispatch_error" IS NULL) AND ("direct_dispatch_updated_at" IS NOT NULL)) OR (("direct_dispatch_status" = 'accepted'::"text") AND ("direct_dispatch_call_id" IS NOT NULL) AND (("direct_dispatch_attempt_count" >= 1) AND ("direct_dispatch_attempt_count" <= 3)) AND ("direct_dispatch_error" IS NULL) AND ("direct_dispatch_updated_at" IS NOT NULL)) OR (("direct_dispatch_status" = 'failed'::"text") AND ("direct_dispatch_call_id" IS NULL) AND (("direct_dispatch_attempt_count" >= 0) AND ("direct_dispatch_attempt_count" <= 3)) AND ("direct_dispatch_error" IS NOT NULL) AND ("direct_dispatch_updated_at" IS NOT NULL)) OR (("direct_dispatch_status" = 'worker_claimed'::"text") AND ("direct_dispatch_call_id" IS NULL) AND (("direct_dispatch_attempt_count" >= 0) AND ("direct_dispatch_attempt_count" <= 3)) AND ("direct_dispatch_updated_at" IS NOT NULL)))),
    CONSTRAINT "import_runs_direct_dispatch_status_check" CHECK (("direct_dispatch_status" = ANY (ARRAY['pending'::"text", 'dispatching'::"text", 'accepted'::"text", 'failed'::"text", 'worker_claimed'::"text"]))),
    CONSTRAINT "import_runs_failure_request_hash" CHECK ((("failure_request_hash" IS NULL) OR ("failure_request_hash" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "import_runs_lease_recovery_count_check" CHECK ((("lease_recovery_count" >= 0) AND ("lease_recovery_count" <= 2))),
    CONSTRAINT "import_runs_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "import_runs_prompt_length" CHECK (("char_length"(COALESCE("request_prompt", ''::"text")) <= 4000)),
    CONSTRAINT "import_runs_request_kind_check" CHECK (("request_kind" = ANY (ARRAY['initial'::"text", 'retry'::"text", 'refinement'::"text"]))),
    CONSTRAINT "import_runs_source_sha256" CHECK ((("source_sha256" IS NULL) OR ("source_sha256" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "import_runs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'succeeded'::"text", 'failed'::"text", 'superseded'::"text"])))
);

ALTER TABLE "public"."import_runs" OWNER TO "postgres";

COMMENT ON TABLE "public"."import_runs" IS 'Immutable processing attempts for a firework video import. Direct dispatch and executor provenance are recorded separately, while lease fields prevent stale workers from winning.';

CREATE TABLE IF NOT EXISTS "public"."ai_credit_accounts" (
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "reserved" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_credit_accounts_balance_check" CHECK (("balance" >= 0)),
    CONSTRAINT "ai_credit_accounts_reserved_balance_check" CHECK (("reserved" <= "balance")),
    CONSTRAINT "ai_credit_accounts_reserved_check" CHECK (("reserved" >= 0))
);

ALTER TABLE "public"."ai_credit_accounts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."ai_credit_costs" (
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "amount" integer NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_credit_costs_amount_check" CHECK (("amount" >= 0)),
    CONSTRAINT "ai_credit_costs_key_check" CHECK (("key" = ANY (ARRAY['music_analysis'::"text", 'show_generation_fast'::"text", 'show_generation_gpt4o'::"text", 'show_generation_sonnet'::"text", 'show_generation_opus'::"text", 'show_refinement'::"text", 'import_video_reconstruction'::"text", 'import_video_refinement'::"text"])))
);

ALTER TABLE "public"."ai_credit_costs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."ai_credit_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "status" "text" DEFAULT 'applied'::"text" NOT NULL,
    "action_key" "text" NOT NULL,
    "amount" integer DEFAULT 0 NOT NULL,
    "balance_after" integer,
    "reserved_after" integer,
    "reference_type" "text",
    "reference_id" "uuid",
    "idempotency_key" "text",
    "related_transaction_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_credit_transactions_amount_check" CHECK (("amount" >= 0)),
    CONSTRAINT "ai_credit_transactions_status_check" CHECK (("status" = ANY (ARRAY['applied'::"text", 'reserved'::"text", 'settled'::"text", 'refunded'::"text"]))),
    CONSTRAINT "ai_credit_transactions_type_check" CHECK (("transaction_type" = ANY (ARRAY['grant'::"text", 'reserve'::"text", 'debit'::"text", 'refund'::"text"])))
);

ALTER TABLE "public"."ai_credit_transactions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."assortment_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assortment_id" "uuid" NOT NULL,
    "catalogue_item_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assortment_items_quantity_check" CHECK (("quantity" >= 1))
);

ALTER TABLE "public"."assortment_items" OWNER TO "postgres";

COMMENT ON TABLE "public"."assortment_items" IS 'Member catalogue_items making up one assortment, with the quantity of each included in the bundle.';

CREATE TABLE IF NOT EXISTS "public"."assortment_public_links" (
    "assortment_id" "uuid" NOT NULL,
    "public_token" "text" DEFAULT ("replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text") || "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text")) NOT NULL,
    "funding_user_id" "uuid" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assortment_public_links_token_entropy_check" CHECK (("public_token" ~ '^[a-f0-9]{64}$'::"text"))
);

ALTER TABLE "public"."assortment_public_links" OWNER TO "postgres";

COMMENT ON TABLE "public"."assortment_public_links" IS 'Protected reusable QR capabilities and interim retailer funding owners. This table is never readable by anon.';

COMMENT ON COLUMN "public"."assortment_public_links"."public_token" IS 'Stable high-entropy QR capability. Normal assortment edits never rotate it.';

COMMENT ON COLUMN "public"."assortment_public_links"."funding_user_id" IS 'Interim single-user retailer billing boundary for anonymous analysis and generation.';

CREATE TABLE IF NOT EXISTS "public"."assortment_song_selections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assortment_id" "uuid",
    "funding_user_id" "uuid" NOT NULL,
    "access_token_hash" "text" NOT NULL,
    "audio_path" "text" NOT NULL,
    "original_filename" "text",
    "content_type" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "music_analysis_id" "uuid",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '02:00:00'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assortment_song_selections_size_bytes_check" CHECK ((("size_bytes" >= 1) AND ("size_bytes" <= 52428800))),
    CONSTRAINT "assortment_song_selections_token_hash_check" CHECK (("access_token_hash" ~ '^[a-f0-9]{64}$'::"text"))
);

ALTER TABLE "public"."assortment_song_selections" OWNER TO "postgres";

COMMENT ON TABLE "public"."assortment_song_selections" IS 'Short-lived anonymous song selection capabilities funded by the owning retailer. Raw access tokens are never stored.';

CREATE TABLE IF NOT EXISTS "public"."assortments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price_cents" integer NOT NULL,
    "cover_shader" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "assortments_price_cents_check" CHECK (("price_cents" >= 0))
);

ALTER TABLE "public"."assortments" OWNER TO "postgres";

COMMENT ON TABLE "public"."assortments" IS 'Retailer-priced bundles of catalogue_items sold physically in-store. A kiosk show generated from a scanned assortment locks its budget and catalogue pool to one row here.';

CREATE TABLE IF NOT EXISTS "public"."backend_dead_letters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_type" "text" NOT NULL,
    "work_key" "text" NOT NULL,
    "user_id" "uuid",
    "severity" "text" DEFAULT 'error'::"text" NOT NULL,
    "reason" "text" NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "occurrence_count" integer DEFAULT 1 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "first_observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolution_note" "text",
    CONSTRAINT "backend_dead_letters_attempt_count_check" CHECK (("attempt_count" >= 0)),
    CONSTRAINT "backend_dead_letters_occurrence_count_check" CHECK (("occurrence_count" > 0)),
    CONSTRAINT "backend_dead_letters_severity_check" CHECK (("severity" = ANY (ARRAY['warning'::"text", 'error'::"text", 'critical'::"text"]))),
    CONSTRAINT "backend_dead_letters_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text", 'ignored'::"text"]))),
    CONSTRAINT "backend_dead_letters_work_type_check" CHECK (("work_type" = ANY (ARRAY['song_analysis'::"text", 'cue_generation'::"text", 'audio_cleanup'::"text"])))
);

ALTER TABLE "public"."backend_dead_letters" OWNER TO "postgres";

COMMENT ON TABLE "public"."backend_dead_letters" IS 'Operational records for exhausted or repeatedly failing asynchronous backend work.';

CREATE TABLE IF NOT EXISTS "public"."catalogue_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "part_number" "text" NOT NULL,
    "name" "text" NOT NULL,
    "manufacturer" "text",
    "description" "text",
    "catalogue_item_kind" "text" NOT NULL,
    "firework_id" "uuid",
    "multishot_id" "uuid",
    "firework_type" "text",
    "duration_seconds" numeric(8,2),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_listed" boolean DEFAULT true NOT NULL,
    CONSTRAINT "catalogue_items_kind_check" CHECK (("catalogue_item_kind" = ANY (ARRAY['firework'::"text", 'multishot'::"text", 'bundle'::"text", 'other'::"text"]))),
    CONSTRAINT "catalogue_items_visual_target_check" CHECK (((("catalogue_item_kind" = 'firework'::"text") AND ("firework_id" IS NOT NULL) AND ("multishot_id" IS NULL)) OR (("catalogue_item_kind" = 'multishot'::"text") AND ("firework_id" IS NULL) AND ("multishot_id" IS NOT NULL)) OR (("catalogue_item_kind" = ANY (ARRAY['bundle'::"text", 'other'::"text"])) AND ("firework_id" IS NULL) AND ("multishot_id" IS NULL))))
);

ALTER TABLE "public"."catalogue_items" OWNER TO "postgres";

COMMENT ON TABLE "public"."catalogue_items" IS 'Supplier-facing catalogue entries. Each row exposes either an atomic firework or a multishot to sourcing and show selection workflows.';

COMMENT ON COLUMN "public"."catalogue_items"."is_listed" IS 'Whether this row is a purchasable public catalogue entry. Internal renderer components remain admin-visible only.';

CREATE TABLE IF NOT EXISTS "public"."firework_editor_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_kind" "text" NOT NULL,
    "firework_id" "uuid",
    "firework_effect_id" "uuid",
    "action" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "snapshot_json" "jsonb" NOT NULL,
    "previous_snapshot_json" "jsonb",
    "changes_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_by_label" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "firework_style_default_id" "uuid",
    CONSTRAINT "firework_editor_versions_action_check" CHECK (("action" = ANY (ARRAY['update'::"text", 'restore'::"text"]))),
    CONSTRAINT "firework_editor_versions_target_fk_check" CHECK (((("target_kind" = 'firework'::"text") AND ("firework_id" IS NOT NULL) AND ("firework_effect_id" IS NULL) AND ("firework_style_default_id" IS NULL)) OR (("target_kind" = 'effect'::"text") AND ("firework_effect_id" IS NOT NULL) AND ("firework_id" IS NULL) AND ("firework_style_default_id" IS NULL)) OR (("target_kind" = 'style_default'::"text") AND ("firework_style_default_id" IS NOT NULL) AND ("firework_id" IS NULL) AND ("firework_effect_id" IS NULL)))),
    CONSTRAINT "firework_editor_versions_target_kind_check" CHECK (("target_kind" = ANY (ARRAY['firework'::"text", 'effect'::"text", 'style_default'::"text"])))
);

ALTER TABLE "public"."firework_editor_versions" OWNER TO "postgres";

COMMENT ON TABLE "public"."firework_editor_versions" IS 'Immutable admin editor version history for fireworks, base firework effects, and style defaults.';

COMMENT ON COLUMN "public"."firework_editor_versions"."snapshot_json" IS 'Canonical editor snapshot after the recorded action.';

COMMENT ON COLUMN "public"."firework_editor_versions"."previous_snapshot_json" IS 'Canonical editor snapshot before the recorded action, when available.';

COMMENT ON COLUMN "public"."firework_editor_versions"."changes_json" IS 'Small machine-readable summary of fields changed by the action.';

COMMENT ON COLUMN "public"."firework_editor_versions"."firework_style_default_id" IS 'Reusable renderer style default changed by this immutable editor version.';

CREATE TABLE IF NOT EXISTS "public"."firework_effects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "pattern_key" "text" NOT NULL,
    "model_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "firework_effects_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'reference'::"text", 'legacy_migrated'::"text", 'video_inferred'::"text", 'llm_generated'::"text"])))
);

ALTER TABLE "public"."firework_effects" OWNER TO "postgres";

COMMENT ON TABLE "public"."firework_effects" IS 'Colourless base firework effect patterns, for example peony, brocade, willow, crossette.';

COMMENT ON COLUMN "public"."firework_effects"."model_json" IS 'Colourless pattern model and renderer defaults. Do not store product-specific colour here.';

CREATE TABLE IF NOT EXISTS "public"."firework_preview_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "firework_effect_id" "uuid",
    "firework_id" "uuid",
    "multishot_id" "uuid",
    "source_revision" bigint DEFAULT 1 NOT NULL,
    "renderer_version" "text",
    "source_signature" "text",
    "storage_path" "text",
    "width" integer,
    "height" integer,
    "captured_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "firework_preview_images_complete_capture_check" CHECK (((("storage_path" IS NULL) AND ("renderer_version" IS NULL) AND ("source_signature" IS NULL) AND ("width" IS NULL) AND ("height" IS NULL) AND ("captured_at" IS NULL)) OR (("storage_path" IS NOT NULL) AND ("renderer_version" IS NOT NULL) AND ("source_signature" IS NOT NULL) AND ("width" IS NOT NULL) AND ("height" IS NOT NULL) AND ("captured_at" IS NOT NULL)))),
    CONSTRAINT "firework_preview_images_dimensions_check" CHECK (((("width" IS NULL) AND ("height" IS NULL)) OR (("width" > 0) AND ("height" > 0)))),
    CONSTRAINT "firework_preview_images_one_target_check" CHECK (("num_nonnulls"("firework_effect_id", "firework_id", "multishot_id") = 1)),
    CONSTRAINT "firework_preview_images_revision_check" CHECK (("source_revision" > 0)),
    CONSTRAINT "firework_preview_images_signature_check" CHECK ((("source_signature" IS NULL) OR ("source_signature" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "firework_preview_images_versioned_path_check" CHECK ((("storage_path" IS NULL) OR (("storage_path" ~ '/r[1-9][0-9]*-[0-9a-f]{64}\.webp$'::"text") AND ("storage_path" ~~
CASE
    WHEN ("firework_effect_id" IS NOT NULL) THEN ((((("renderer_version" || '/effect/'::"text") || ("firework_effect_id")::"text") || '/r'::"text") || ("source_revision")::"text") || '-%'::"text")
    WHEN ("firework_id" IS NOT NULL) THEN ((((("renderer_version" || '/firework/'::"text") || ("firework_id")::"text") || '/r'::"text") || ("source_revision")::"text") || '-%'::"text")
    ELSE ((((("renderer_version" || '/multishot/'::"text") || ("multishot_id")::"text") || '/r'::"text") || ("source_revision")::"text") || '-%'::"text")
END))))
);

ALTER TABLE "public"."firework_preview_images" OWNER TO "postgres";

COMMENT ON TABLE "public"."firework_preview_images" IS 'Public manifest for immutable renderer stills used by firework browse cards.';

COMMENT ON COLUMN "public"."firework_preview_images"."source_revision" IS 'Monotonic visual-source revision used to reject captures that finish after an edit.';

COMMENT ON COLUMN "public"."firework_preview_images"."storage_path" IS 'Immutable WebP path in the public firework-previews bucket; null while capture is required.';

CREATE TABLE IF NOT EXISTS "public"."firework_style_defaults" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "kind" "text" NOT NULL,
    "defaults_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "firework_style_defaults_kind_check" CHECK (("kind" = ANY (ARRAY['geometry'::"text", 'star'::"text", 'trail'::"text", 'launch'::"text", 'smoke'::"text", 'strobe'::"text", 'crackle'::"text", 'split'::"text", 'sound'::"text"])))
);

ALTER TABLE "public"."firework_style_defaults" OWNER TO "postgres";

COMMENT ON TABLE "public"."firework_style_defaults" IS 'Reusable live renderer style defaults for firework stars and trails.';

COMMENT ON COLUMN "public"."firework_style_defaults"."defaults_json" IS 'Design-shaped renderer fragment merged before local effect or firework overrides.';

CREATE TABLE IF NOT EXISTS "public"."fireworks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "firework_effect_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "primary_color" "text",
    "secondary_color" "text",
    "color_palette" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "caliber" "text",
    "duration_seconds" numeric,
    "height_meters" numeric,
    "variant_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "render_overrides_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "confidence" numeric DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "firework_variants_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "firework_variants_duration_check" CHECK ((("duration_seconds" IS NULL) OR ("duration_seconds" > (0)::numeric))),
    CONSTRAINT "firework_variants_height_check" CHECK ((("height_meters" IS NULL) OR ("height_meters" >= (0)::numeric))),
    CONSTRAINT "firework_variants_primary_color_check" CHECK ((("primary_color" IS NULL) OR ("primary_color" ~* '^#[0-9a-f]{6}$'::"text"))),
    CONSTRAINT "firework_variants_secondary_color_check" CHECK ((("secondary_color" IS NULL) OR ("secondary_color" ~* '^#[0-9a-f]{6}$'::"text"))),
    CONSTRAINT "firework_variants_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'catalogue'::"text", 'legacy_migrated'::"text", 'video_inferred'::"text", 'llm_generated'::"text"])))
);

ALTER TABLE "public"."fireworks" OWNER TO "postgres";

COMMENT ON TABLE "public"."fireworks" IS 'Atomic visual fireworks: one ignition and one rendered visual outcome.';

COMMENT ON COLUMN "public"."fireworks"."firework_effect_id" IS 'Base visual pattern from public.firework_effects.';

COMMENT ON COLUMN "public"."fireworks"."render_overrides_json" IS 'Firework-level renderer overrides applied on top of the base effect model.';

CREATE TABLE IF NOT EXISTS "public"."generation_settings" (
    "key" "text" NOT NULL,
    "generation_mode" "text" DEFAULT 'fast'::"text" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "product_catalogue_fields" "jsonb" DEFAULT '["id", "name", "description", "durationSeconds", "shotCount", "isMultiShot", "heightMeters", "caliber", "shellType", "color", "colorPalette", "effects"]'::"jsonb" NOT NULL,
    CONSTRAINT "generation_settings_key_check" CHECK (("key" = 'show_cue_generation'::"text")),
    CONSTRAINT "generation_settings_mode_check" CHECK (("generation_mode" = ANY (ARRAY['fast'::"text", 'llm'::"text"]))),
    CONSTRAINT "generation_settings_product_catalogue_fields_array_check" CHECK (("jsonb_typeof"("product_catalogue_fields") = 'array'::"text"))
);

ALTER TABLE "public"."generation_settings" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."impersonation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "return_token_hash" "text" NOT NULL,
    "user_agent" "text",
    "ip_address" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '02:00:00'::interval) NOT NULL,
    "ended_at" timestamp with time zone,
    "end_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "impersonation_sessions_check" CHECK (("admin_user_id" <> "target_user_id")),
    CONSTRAINT "impersonation_sessions_check1" CHECK ((("ended_at" IS NULL) OR ("ended_at" >= "started_at"))),
    CONSTRAINT "impersonation_sessions_end_reason_check" CHECK (("end_reason" = ANY (ARRAY['stopped'::"text", 'expired'::"text", 'sign_out'::"text", 'error'::"text"])))
);

ALTER TABLE "public"."impersonation_sessions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."import_candidate_render_validations" (
    "candidate_id" "uuid" NOT NULL,
    "validator_version" "text" NOT NULL,
    "renderer_contract_version" "text" NOT NULL,
    "metrics_schema_version" "text" NOT NULL,
    "canonical_evidence" "jsonb" NOT NULL,
    "evidence_hash" "text" NOT NULL,
    "artifact_storage_path" "text" NOT NULL,
    "artifact_sha256" text NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
    "artifact_byte_size" bigint NOT NULL CHECK (artifact_byte_size > 0),
    "artifact_storage_etag" text NOT NULL CHECK (artifact_storage_etag ~ '^[0-9a-f]{32}(-[1-9][0-9]*)?$'),
    "artifact_output_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_candidate_render_validations_evidence_hash_check" CHECK (("evidence_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "import_candidate_render_validations_evidence_object" CHECK (("jsonb_typeof"("canonical_evidence") = 'object'::"text"))
);

ALTER TABLE "public"."import_candidate_render_validations" OWNER TO "postgres";

COMMENT ON TABLE "public"."import_candidate_render_validations" IS 'Immutable publication seals for exact FireworksEngine comparison evidence and its retained review artefact.';

CREATE TABLE IF NOT EXISTS "public"."import_candidate_validations" (
    "candidate_id" "uuid" NOT NULL,
    "validator_version" "text" NOT NULL,
    "canonical_reconstruction" "jsonb" NOT NULL,
    "content_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_candidate_validations_content_hash_check" CHECK (("content_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "import_candidate_validations_reconstruction_object" CHECK (("jsonb_typeof"("canonical_reconstruction") = 'object'::"text"))
);

ALTER TABLE "public"."import_candidate_validations" OWNER TO "postgres";

COMMENT ON TABLE "public"."import_candidate_validations" IS 'Immutable canonical renderer validation seals produced by the trusted application validator.';

CREATE TABLE IF NOT EXISTS "public"."import_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_run_id" "uuid" NOT NULL,
    "ordinal" integer NOT NULL,
    "schema_version" "text" NOT NULL,
    "reconstruction" "jsonb" NOT NULL,
    "score" numeric(6,5) NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "validation" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "content_hash" "text" NOT NULL,
    "rendered_video_path" "text",
    "selected_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_candidates_content_hash_check" CHECK (("content_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "import_candidates_ordinal_check" CHECK (("ordinal" >= 0)),
    CONSTRAINT "import_candidates_reconstruction_object" CHECK (("jsonb_typeof"("reconstruction") = 'object'::"text")),
    CONSTRAINT "import_candidates_score_check" CHECK ((("score" >= (0)::numeric) AND ("score" <= (1)::numeric))),
    CONSTRAINT "import_candidates_validation_object" CHECK (("jsonb_typeof"("validation") = 'object'::"text"))
);

ALTER TABLE "public"."import_candidates" OWNER TO "postgres";

COMMENT ON TABLE "public"."import_candidates" IS 'Immutable renderer-native reconstruction candidates, including scores and validation evidence.';

CREATE TABLE IF NOT EXISTS "public"."import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid",
    "kind" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "source_name" "text" NOT NULL,
    "source_url" "text",
    "media_asset_id" "uuid",
    "row_count" integer,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "selected_model" "text",
    "processing_progress" integer DEFAULT 0 NOT NULL,
    "processor_version" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "approved_catalogue_item_id" "uuid",
    "active_run_id" "uuid",
    "selected_candidate_id" "uuid",
    "approved_run_id" "uuid",
    "approved_candidate_id" "uuid",
    "approval_request_hash" "text",
    "selected_by" "uuid",
    "selected_at" timestamp with time zone,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "archived_by" "uuid",
    CONSTRAINT "import_jobs_approval_request_hash" CHECK ((("approval_request_hash" IS NULL) OR ("approval_request_hash" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "import_jobs_kind_check" CHECK (("kind" = ANY (ARRAY['vdl_glossary'::"text", 'firework_video'::"text", 'supplier_stock'::"text"]))),
    CONSTRAINT "import_jobs_processing_progress_check" CHECK ((("processing_progress" >= 0) AND ("processing_progress" <= 100))),
    CONSTRAINT "import_jobs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'queued'::"text", 'processing'::"text", 'needs_review'::"text", 'complete'::"text", 'failed'::"text"])))
);

ALTER TABLE "public"."import_jobs" OWNER TO "postgres";

COMMENT ON COLUMN "public"."import_jobs"."approved_catalogue_item_id" IS 'Canonical catalogue item approved from an import job. approved_product_id is deprecated.';

CREATE TABLE IF NOT EXISTS "public"."import_outputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_job_id" "uuid" NOT NULL,
    "output_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_outputs_output_type_check" CHECK (("output_type" = ANY (ARRAY['raw_rows'::"text", 'model_output'::"text", 'review_notes'::"text", 'frame_analysis'::"text", 'audio_analysis'::"text", 'generated_spec'::"text", 'draft_spec'::"text", 'refinement'::"text", 'processing_log'::"text"])))
);

ALTER TABLE "public"."import_outputs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."import_run_outputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_run_id" "uuid" NOT NULL,
    "stage" "text" NOT NULL,
    "sequence" integer NOT NULL,
    "output_type" "text" NOT NULL,
    "schema_version" "text" NOT NULL,
    "content_hash" "text",
    "payload" "jsonb" NOT NULL,
    "storage_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_run_outputs_content_hash" CHECK ((("content_hash" IS NULL) OR ("content_hash" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "import_run_outputs_output_type_check" CHECK (("output_type" = ANY (ARRAY['probe'::"text", 'frame_observations'::"text", 'audio_observations'::"text", 'video_observations'::"text", 'candidate_draft'::"text", 'render_metrics'::"text", 'critic_review'::"text", 'processing_log'::"text"]))),
    CONSTRAINT "import_run_outputs_sequence_check" CHECK (("sequence" >= 0))
);

ALTER TABLE "public"."import_run_outputs" OWNER TO "postgres";

COMMENT ON TABLE "public"."import_run_outputs" IS 'Append-only evidence and processing artefacts produced by one reconstruction run.';

CREATE TABLE IF NOT EXISTS "public"."jamendo_response_cache" (
    "cache_key" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."jamendo_response_cache" OWNER TO "postgres";

COMMENT ON TABLE "public"."jamendo_response_cache" IS 'Durable server-side cache of Jamendo search/browse responses keyed by normalised query. Service-role only; not user data.';

CREATE TABLE IF NOT EXISTS "public"."media_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "source_type" "text" NOT NULL,
    "url" "text",
    "storage_path" "text",
    "mime_type" "text",
    "duration_seconds" numeric(8,2),
    "width" integer,
    "height" integer,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "media_assets_source_type_check" CHECK (("source_type" = ANY (ARRAY['upload'::"text", 'loom'::"text", 'external_url'::"text"])))
);

ALTER TABLE "public"."media_assets" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."multishot_fireworks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "multishot_id" "uuid" NOT NULL,
    "firework_id" "uuid" NOT NULL,
    "sequence_index" integer NOT NULL,
    "time_offset_seconds" numeric DEFAULT 0 NOT NULL,
    "pan_degrees" integer DEFAULT 0 NOT NULL,
    "tilt_degrees" integer DEFAULT 0 NOT NULL,
    "position_override_json" "jsonb",
    "caliber" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "timeline_track_index" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "multishot_fireworks_caliber_length" CHECK (("char_length"(COALESCE("caliber", ''::"text")) <= 40)),
    CONSTRAINT "multishot_fireworks_notes_length" CHECK (("char_length"(COALESCE("notes", ''::"text")) <= 500)),
    CONSTRAINT "multishot_fireworks_pan_range" CHECK ((("pan_degrees" >= '-30'::integer) AND ("pan_degrees" <= 30))),
    CONSTRAINT "multishot_fireworks_sequence_range" CHECK ((("sequence_index" >= 1) AND ("sequence_index" <= 2000))),
    CONSTRAINT "multishot_fireworks_tilt_range" CHECK ((("tilt_degrees" >= '-50'::integer) AND ("tilt_degrees" <= 50))),
    CONSTRAINT "multishot_fireworks_time_offset_seconds_check" CHECK (("time_offset_seconds" >= (0)::numeric)),
    CONSTRAINT "multishot_fireworks_time_range" CHECK ((("time_offset_seconds" >= (0)::numeric) AND ("time_offset_seconds" <= (3600)::numeric))),
    CONSTRAINT "multishot_fireworks_timeline_track_range" CHECK ((("timeline_track_index" >= 0) AND ("timeline_track_index" <= 1999)))
);

ALTER TABLE "public"."multishot_fireworks" OWNER TO "postgres";

COMMENT ON TABLE "public"."multishot_fireworks" IS 'Ordered firework sequence inside each multishot.';

COMMENT ON COLUMN "public"."multishot_fireworks"."timeline_track_index" IS 'Zero-based editor track that keeps timeline placement stable when shot timing changes.';

CREATE TABLE IF NOT EXISTS "public"."multishots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "duration_seconds" numeric(8,2),
    "shot_count" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "multishots_description_length" CHECK (("char_length"(COALESCE("description", ''::"text")) <= 5000)),
    CONSTRAINT "multishots_duration_range" CHECK ((("duration_seconds" IS NULL) OR (("duration_seconds" >= (0)::numeric) AND ("duration_seconds" <= (3600)::numeric)))),
    CONSTRAINT "multishots_name_length" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 180))),
    CONSTRAINT "multishots_shot_count_check" CHECK (("shot_count" >= 0)),
    CONSTRAINT "multishots_shot_count_range" CHECK ((("shot_count" >= 0) AND ("shot_count" <= 2000)))
);

ALTER TABLE "public"."multishots" OWNER TO "postgres";

COMMENT ON TABLE "public"."multishots" IS 'Composite visual fireworks made from ordered atomic fireworks.';

CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."permissions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."prompt_configs" (
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "system_prompt_text" "text" NOT NULL,
    "product_context_text" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "prompt_configs_key_check" CHECK (("key" = ANY (ARRAY['show_cue_generation'::"text", 'firework_video_reconstruction'::"text"]))),
    CONSTRAINT "prompt_configs_system_prompt_not_blank" CHECK (("length"(TRIM(BOTH FROM "system_prompt_text")) > 0))
);

ALTER TABLE "public"."prompt_configs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."role_permissions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."roles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."show_assortment_items" (
    "show_id" "uuid" NOT NULL,
    "catalogue_item_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "show_assortment_items_quantity_check" CHECK ((("quantity" >= 1) AND ("quantity" <= 999)))
);

ALTER TABLE "public"."show_assortment_items" OWNER TO "postgres";

COMMENT ON TABLE "public"."show_assortment_items" IS 'Immutable SKU quantity snapshot captured atomically when an assortment QR show is created.';

CREATE TABLE IF NOT EXISTS "public"."show_assortment_selections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "show_id" "uuid" NOT NULL,
    "assortment_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "show_assortment_selections_quantity_check" CHECK ((("quantity" >= 1) AND ("quantity" <= 20)))
);

ALTER TABLE "public"."show_assortment_selections" OWNER TO "postgres";

COMMENT ON TABLE "public"."show_assortment_selections" IS 'Assortments a guest scanned/selected for a show, with how many units of each. A show''s allowed catalogue pool and per-firework quantity caps are the additive merge of these rows (see lib/assortments.server.ts#getMergedAssortmentAllowance).';

CREATE TABLE IF NOT EXISTS "public"."show_generation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "show_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "schema_version" "text" DEFAULT '1.2.0'::"text" NOT NULL,
    "personality" "text" DEFAULT 'balanced'::"text" NOT NULL,
    "audio_path" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'complete'::"text" NOT NULL,
    "analysis_json" "jsonb",
    "llm_payload" "jsonb",
    "markdown" "text",
    "runner_version" "text",
    "runtime_ms" integer,
    "error_message" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cue_generation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "cue_generation_error" "text",
    "cue_count" integer,
    CONSTRAINT "show_analyses_cue_generation_status_check" CHECK (("cue_generation_status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'skipped'::"text"]))),
    CONSTRAINT "show_analyses_runtime_ms_check" CHECK ((("runtime_ms" IS NULL) OR ("runtime_ms" >= 0))),
    CONSTRAINT "show_analyses_schema_version_format" CHECK (("schema_version" ~ '^[0-9]+\.[0-9]+\.[0-9]+$'::"text")),
    CONSTRAINT "show_analyses_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text"])))
);

ALTER TABLE "public"."show_generation_runs" OWNER TO "postgres";

COMMENT ON TABLE "public"."show_generation_runs" IS 'Per-show generation attempt history, replacing legacy public.show_analyses.';

CREATE TABLE IF NOT EXISTS "public"."show_preset_like_counts" (
    "show_preset_id" "uuid" NOT NULL,
    "like_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "show_preset_like_counts_like_count_check" CHECK (("like_count" >= 0))
);

ALTER TABLE "public"."show_preset_like_counts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."show_preset_likes" (
    "show_preset_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."show_preset_likes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."show_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "theme" "text" NOT NULL,
    "description" "text",
    "duration_seconds" integer,
    "budget_cents" integer,
    "total_cents" integer DEFAULT 0 NOT NULL,
    "effects_count" integer DEFAULT 0 NOT NULL,
    "time_of_day" "text",
    "mood_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "preview_cues" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cover_shader" "jsonb",
    "cover_image_path" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "published_at" timestamp with time zone,
    "source_show_id" "uuid",
    "composition_signature" "text" GENERATED ALWAYS AS ("public"."show_preset_composition_signature"("preview_cues")) STORED NOT NULL,
    CONSTRAINT "show_presets_budget_nonnegative" CHECK ((("budget_cents" IS NULL) OR ("budget_cents" >= 0))),
    CONSTRAINT "show_presets_duration_positive" CHECK ((("duration_seconds" IS NULL) OR ("duration_seconds" > 0))),
    CONSTRAINT "show_presets_effects_nonnegative" CHECK (("effects_count" >= 0)),
    CONSTRAINT "show_presets_preview_cues_array" CHECK (("jsonb_typeof"("preview_cues") = 'array'::"text")),
    CONSTRAINT "show_presets_published_shape" CHECK (((NOT "is_published") OR (("duration_seconds" IS NOT NULL) AND ("duration_seconds" > 0) AND ("published_at" IS NOT NULL) AND
CASE
    WHEN ("jsonb_typeof"("preview_cues") = 'array'::"text") THEN ("jsonb_array_length"("preview_cues") > 0)
    ELSE false
END))),
    CONSTRAINT "show_presets_sort_order_nonnegative" CHECK (("sort_order" >= 0)),
    CONSTRAINT "show_presets_total_nonnegative" CHECK (("total_cents" >= 0))
);

ALTER TABLE "public"."show_presets" OWNER TO "postgres";

COMMENT ON TABLE "public"."show_presets" IS 'Reusable show presets shown in the library.';

COMMENT ON COLUMN "public"."show_presets"."cover_image_path" IS 'Storage path of the pre-rendered cover PNG in the covers bucket; null until rendered.';

COMMENT ON COLUMN "public"."show_presets"."is_published" IS 'Controls whether a curated show preset is visible to public Explore/Home reads.';

COMMENT ON COLUMN "public"."show_presets"."published_at" IS 'Timestamp when the curated show preset was last published.';

COMMENT ON COLUMN "public"."show_presets"."source_show_id" IS 'Generated show imported into this curated preset; null for manually curated presets.';

COMMENT ON COLUMN "public"."show_presets"."composition_signature" IS 'Generated cue-composition key used to avoid repeating equivalent shows across Explore shelves.';

CREATE TABLE IF NOT EXISTS "public"."show_timeline_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "show_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "time_seconds" numeric(8,2) NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "label" "text",
    "locked" boolean DEFAULT false NOT NULL,
    "track" "text",
    "layer" "text",
    "seed_override" integer,
    "launch_position_index" smallint DEFAULT 0 NOT NULL,
    "catalogue_item_id" "uuid" NOT NULL,
    "emphasis" "text" DEFAULT 'normal'::"text" NOT NULL,
    CONSTRAINT "show_cues_launch_position_index_check" CHECK ((("launch_position_index" >= 0) AND ("launch_position_index" <= 2))),
    CONSTRAINT "show_timeline_items_emphasis_check" CHECK (("emphasis" = ANY (ARRAY['normal'::"text", 'accent'::"text", 'peak'::"text"]))),
    CONSTRAINT "show_timeline_items_position_positive" CHECK (("position" > 0)),
    CONSTRAINT "show_timeline_items_time_nonnegative" CHECK (("time_seconds" >= (0)::numeric))
);

ALTER TABLE "public"."show_timeline_items" OWNER TO "postgres";

COMMENT ON TABLE "public"."show_timeline_items" IS 'Scheduled catalogue items on a show timeline.';

COMMENT ON COLUMN "public"."show_timeline_items"."catalogue_item_id" IS 'Selected supplier-facing catalogue item.';

CREATE TABLE IF NOT EXISTS "public"."shows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "song" "text",
    "artist" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "duration_seconds" integer,
    "budget_cents" integer,
    "total_cents" integer DEFAULT 0 NOT NULL,
    "effects_count" integer DEFAULT 0 NOT NULL,
    "sync_percent" numeric(5,2),
    "safety_meters" integer,
    "time_of_day" "text",
    "location" "text",
    "description" "text",
    "mood_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "audio_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "launch_positions_json" "jsonb" DEFAULT '[{"x": -200, "y": 0, "z": 0}, {"x": 0, "y": 0, "z": 0}, {"x": 200, "y": 0, "z": 0}]'::"jsonb" NOT NULL,
    "music_analysis_id" "uuid",
    "generation_status" "text" DEFAULT 'idle'::"text" NOT NULL,
    "generation_error" "text",
    "generated_cue_count" integer,
    "generation_started_at" timestamp with time zone,
    "generation_completed_at" timestamp with time zone,
    "show_style" "text" DEFAULT 'signature'::"text" NOT NULL,
    "site_width_feet" integer,
    "firework_types" "text"[],
    "cover_shader" "jsonb",
    "selected_cue_model" "text",
    "cover_image_path" "text",
    "generation_attempt_count" integer DEFAULT 0 NOT NULL,
    "generation_lease_token" "uuid",
    "generation_lease_expires_at" timestamp with time zone,
    "generation_last_attempt_at" timestamp with time zone,
    "generation_next_retry_at" timestamp with time zone,
    "generation_runtime_ms" integer,
    "assortment_song_selection_id" "uuid",
    "creation_source" "text" DEFAULT 'app'::"text" NOT NULL,
    "public_access_token_hash" "text",
    "assortment_id" "uuid",
    CONSTRAINT "shows_assortment_qr_provenance_check" CHECK (((("creation_source" = 'app'::"text") AND ("assortment_song_selection_id" IS NULL) AND ("public_access_token_hash" IS NULL)) OR (("creation_source" = 'assortment_qr'::"text") AND ("assortment_song_selection_id" IS NOT NULL) AND ("public_access_token_hash" ~ '^[a-f0-9]{64}$'::"text")))),
    CONSTRAINT "shows_budget_nonnegative" CHECK ((("budget_cents" IS NULL) OR ("budget_cents" >= 0))),
    CONSTRAINT "shows_creation_source_check" CHECK (("creation_source" = ANY (ARRAY['app'::"text", 'assortment_qr'::"text"]))),
    CONSTRAINT "shows_duration_positive" CHECK ((("duration_seconds" IS NULL) OR ("duration_seconds" > 0))),
    CONSTRAINT "shows_effects_nonnegative" CHECK (("effects_count" >= 0)),
    CONSTRAINT "shows_generation_attempt_count_check" CHECK ((("generation_attempt_count" >= 0) AND ("generation_attempt_count" <= 3))),
    CONSTRAINT "shows_generation_lease_pair_check" CHECK ((("generation_lease_token" IS NULL) = ("generation_lease_expires_at" IS NULL))),
    CONSTRAINT "shows_generation_runtime_ms_check" CHECK ((("generation_runtime_ms" IS NULL) OR ("generation_runtime_ms" >= 0))),
    CONSTRAINT "shows_generation_status_check" CHECK (("generation_status" = ANY (ARRAY['idle'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "shows_safety_nonnegative" CHECK ((("safety_meters" IS NULL) OR ("safety_meters" >= 0))),
    CONSTRAINT "shows_show_style_check" CHECK (("show_style" = ANY (ARRAY['signature'::"text", 'cinematic'::"text", 'minimalist'::"text", 'beat_test'::"text"]))),
    CONSTRAINT "shows_site_width_feet_check" CHECK ((("site_width_feet" IS NULL) OR (("site_width_feet" >= 5) AND ("site_width_feet" <= 2000)))),
    CONSTRAINT "shows_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'complete'::"text"]))),
    CONSTRAINT "shows_sync_percent_range" CHECK ((("sync_percent" IS NULL) OR (("sync_percent" >= (0)::numeric) AND ("sync_percent" <= (100)::numeric)))),
    CONSTRAINT "shows_total_nonnegative" CHECK (("total_cents" >= 0))
);

ALTER TABLE "public"."shows" OWNER TO "postgres";

COMMENT ON COLUMN "public"."shows"."selected_cue_model" IS 'OpenRouter cue-assignment model selected by the creator. Null falls back to the server default.';

COMMENT ON COLUMN "public"."shows"."cover_image_path" IS 'Storage path of the pre-rendered cover PNG in the covers bucket; null until rendered.';

COMMENT ON COLUMN "public"."shows"."generation_lease_token" IS 'Opaque write-fencing token for the active cue-generation worker.';

COMMENT ON COLUMN "public"."shows"."generation_next_retry_at" IS 'Earliest time a transient cue-generation failure may be claimed again.';

CREATE TABLE IF NOT EXISTS "public"."song_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "audio_path" "text" NOT NULL,
    "original_filename" "text",
    "content_type" "text",
    "size_bytes" bigint,
    "schema_version" "text" DEFAULT '1.2.0'::"text" NOT NULL,
    "personality" "text" DEFAULT 'balanced'::"text" NOT NULL,
    "runner_version" "text",
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "runtime_ms" integer,
    "analysis_json" "jsonb",
    "markdown" "text",
    "error_message" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "lease_token" "uuid",
    "lease_expires_at" timestamp with time zone,
    "last_attempt_at" timestamp with time zone,
    "next_retry_at" timestamp with time zone,
    "source_provider" "text",
    "source_track_id" "text",
    "source_title" "text",
    "source_artist" "text",
    "source_url" "text",
    "source_licence_name" "text",
    "source_licence_url" "text",
    CONSTRAINT "music_analyses_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "song_analyses_attempt_count_check" CHECK ((("attempt_count" >= 0) AND ("attempt_count" <= 3))),
    CONSTRAINT "song_analyses_lease_pair_check" CHECK ((("lease_token" IS NULL) = ("lease_expires_at" IS NULL))),
    CONSTRAINT "song_analyses_source_attribution_check" CHECK (((("source_provider" IS NULL) AND ("source_track_id" IS NULL) AND ("source_title" IS NULL) AND ("source_artist" IS NULL) AND ("source_url" IS NULL) AND ("source_licence_name" IS NULL) AND ("source_licence_url" IS NULL)) OR (("source_provider" = 'jamendo'::"text") AND ("source_track_id" ~ '^[0-9]+$'::"text") AND ("length"("source_track_id") <= 24) AND (("length"(TRIM(BOTH FROM "source_title")) >= 1) AND ("length"(TRIM(BOTH FROM "source_title")) <= 180)) AND (("length"(TRIM(BOTH FROM "source_artist")) >= 1) AND ("length"(TRIM(BOTH FROM "source_artist")) <= 180)) AND ("source_url" = ('https://www.jamendo.com/track/'::"text" || "source_track_id")) AND ("source_licence_name" ~ '^(CC0|CC BY(-NC)?(-SA|-ND)?) [0-9]+(\.[0-9]+)?$'::"text") AND ("source_licence_url" ~ '^https://creativecommons\.org/(licenses/by(-nc)?(-sa|-nd)?|publicdomain/zero)/[0-9]+(\.[0-9]+)?/$'::"text"))))
);

ALTER TABLE "public"."song_analyses" OWNER TO "postgres";

COMMENT ON TABLE "public"."song_analyses" IS 'Upload-scoped song analysis rows generated after audio upload.';

COMMENT ON COLUMN "public"."song_analyses"."attempt_count" IS 'Number of claimed analyser attempts. Automatic recovery is capped at three.';

COMMENT ON COLUMN "public"."song_analyses"."lease_token" IS 'Opaque write-fencing token for the active analyser worker.';

COMMENT ON COLUMN "public"."song_analyses"."lease_expires_at" IS 'Deadline after which reconciliation may recover work from a stale worker.';

COMMENT ON COLUMN "public"."song_analyses"."next_retry_at" IS 'Earliest time a transient analyser failure may be claimed again.';

COMMENT ON COLUMN "public"."song_analyses"."source_provider" IS 'External soundtrack provider, currently jamendo; null for user uploads.';

COMMENT ON COLUMN "public"."song_analyses"."source_track_id" IS 'Provider-owned track identifier used for provenance and idempotent attribution.';

COMMENT ON COLUMN "public"."song_analyses"."source_title" IS 'Provider-supplied track title displayed with the soundtrack attribution.';

COMMENT ON COLUMN "public"."song_analyses"."source_artist" IS 'Provider-supplied artist name displayed with the soundtrack attribution.';

COMMENT ON COLUMN "public"."song_analyses"."source_url" IS 'Canonical provider page linked anywhere the sourced soundtrack is played.';

COMMENT ON COLUMN "public"."song_analyses"."source_licence_name" IS 'Short Creative Commons licence label for the sourced soundtrack.';

COMMENT ON COLUMN "public"."song_analyses"."source_licence_url" IS 'Canonical Creative Commons licence URL for the sourced soundtrack.';

CREATE TABLE IF NOT EXISTS "public"."supplier_inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "supplier_sku" "text",
    "quantity_on_hand" integer DEFAULT 0 NOT NULL,
    "price_cents" integer,
    "currency" "text" DEFAULT 'AUD'::"text" NOT NULL,
    "available" boolean DEFAULT true NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "catalogue_item_id" "uuid",
    CONSTRAINT "supplier_inventory_items_price_cents_check" CHECK ((("price_cents" IS NULL) OR ("price_cents" >= 0))),
    CONSTRAINT "supplier_inventory_items_quantity_on_hand_check" CHECK (("quantity_on_hand" >= 0))
);

ALTER TABLE "public"."supplier_inventory_items" OWNER TO "postgres";

COMMENT ON COLUMN "public"."supplier_inventory_items"."catalogue_item_id" IS 'Canonical catalogue item stocked by this supplier. product_id is deprecated.';

CREATE TABLE IF NOT EXISTS "public"."supplier_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "contact_email" "text",
    "phone" "text",
    "website_url" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "supplier_profiles_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'suspended'::"text", 'archived'::"text"])))
);

ALTER TABLE "public"."supplier_profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."user_permission_overrides" (
    "user_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."user_permission_overrides" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."user_roles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "phone" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "theme_preference" "text" DEFAULT 'system'::"text" NOT NULL,
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text"]))),
    CONSTRAINT "profiles_theme_preference_check" CHECK (("theme_preference" = ANY (ARRAY['dark'::"text", 'light'::"text", 'system'::"text"])))
);

ALTER TABLE "public"."users" OWNER TO "postgres";
