export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_credit_accounts: {
        Row: {
          balance: number
          created_at: string
          reserved: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          reserved?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          reserved?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_credit_costs: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          key: string
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          key: string
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_costs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_transactions: {
        Row: {
          action_key: string
          amount: number
          balance_after: number | null
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          reference_id: string | null
          reference_type: string | null
          related_transaction_id: string | null
          reserved_after: number | null
          status: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          action_key: string
          amount?: number
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          related_transaction_id?: string | null
          reserved_after?: number | null
          status?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          action_key?: string
          amount?: number
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          related_transaction_id?: string | null
          reserved_after?: number | null
          status?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_transactions_related_transaction_id_fkey"
            columns: ["related_transaction_id"]
            isOneToOne: false
            referencedRelation: "ai_credit_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      assortment_items: {
        Row: {
          assortment_id: string
          catalogue_item_id: string
          created_at: string
          id: string
          quantity: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          assortment_id: string
          catalogue_item_id: string
          created_at?: string
          id?: string
          quantity?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          assortment_id?: string
          catalogue_item_id?: string
          created_at?: string
          id?: string
          quantity?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assortment_items_assortment_id_fkey"
            columns: ["assortment_id"]
            isOneToOne: false
            referencedRelation: "assortments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assortment_items_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      assortment_public_links: {
        Row: {
          assortment_id: string
          created_at: string
          funding_user_id: string
          is_enabled: boolean
          public_token: string
          updated_at: string
        }
        Insert: {
          assortment_id: string
          created_at?: string
          funding_user_id: string
          is_enabled?: boolean
          public_token?: string
          updated_at?: string
        }
        Update: {
          assortment_id?: string
          created_at?: string
          funding_user_id?: string
          is_enabled?: boolean
          public_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assortment_public_links_assortment_id_fkey"
            columns: ["assortment_id"]
            isOneToOne: true
            referencedRelation: "assortments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assortment_public_links_funding_user_id_fkey"
            columns: ["funding_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      assortment_song_selections: {
        Row: {
          access_token_hash: string
          assortment_id: string | null
          audio_path: string
          content_type: string
          created_at: string
          expires_at: string
          funding_user_id: string
          id: string
          music_analysis_id: string | null
          original_filename: string | null
          size_bytes: number
        }
        Insert: {
          access_token_hash: string
          assortment_id?: string | null
          audio_path: string
          content_type: string
          created_at?: string
          expires_at?: string
          funding_user_id: string
          id?: string
          music_analysis_id?: string | null
          original_filename?: string | null
          size_bytes: number
        }
        Update: {
          access_token_hash?: string
          assortment_id?: string | null
          audio_path?: string
          content_type?: string
          created_at?: string
          expires_at?: string
          funding_user_id?: string
          id?: string
          music_analysis_id?: string | null
          original_filename?: string | null
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "assortment_song_selections_assortment_id_fkey"
            columns: ["assortment_id"]
            isOneToOne: false
            referencedRelation: "assortments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assortment_song_selections_funding_user_id_fkey"
            columns: ["funding_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assortment_song_selections_music_analysis_id_fkey"
            columns: ["music_analysis_id"]
            isOneToOne: false
            referencedRelation: "song_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      assortments: {
        Row: {
          cover_shader: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          slug: string
          updated_at: string
        }
        Insert: {
          cover_shader?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          slug: string
          updated_at?: string
        }
        Update: {
          cover_shader?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assortments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      backend_dead_letters: {
        Row: {
          attempt_count: number
          first_observed_at: string
          id: string
          last_observed_at: string
          metadata: Json
          occurrence_count: number
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          severity: string
          status: string
          user_id: string | null
          work_key: string
          work_type: string
        }
        Insert: {
          attempt_count?: number
          first_observed_at?: string
          id?: string
          last_observed_at?: string
          metadata?: Json
          occurrence_count?: number
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          user_id?: string | null
          work_key: string
          work_type: string
        }
        Update: {
          attempt_count?: number
          first_observed_at?: string
          id?: string
          last_observed_at?: string
          metadata?: Json
          occurrence_count?: number
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          user_id?: string | null
          work_key?: string
          work_type?: string
        }
        Relationships: []
      }
      catalogue_items: {
        Row: {
          catalogue_item_kind: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          firework_id: string | null
          firework_type: string | null
          id: string
          is_listed: boolean
          manufacturer: string | null
          metadata: Json
          multishot_id: string | null
          name: string
          part_number: string
          updated_at: string
        }
        Insert: {
          catalogue_item_kind: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          firework_id?: string | null
          firework_type?: string | null
          id?: string
          is_listed?: boolean
          manufacturer?: string | null
          metadata?: Json
          multishot_id?: string | null
          name: string
          part_number: string
          updated_at?: string
        }
        Update: {
          catalogue_item_kind?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          firework_id?: string | null
          firework_type?: string | null
          id?: string
          is_listed?: boolean
          manufacturer?: string | null
          metadata?: Json
          multishot_id?: string | null
          name?: string
          part_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_items_firework_id_fkey"
            columns: ["firework_id"]
            isOneToOne: false
            referencedRelation: "fireworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogue_items_multishot_id_fkey"
            columns: ["multishot_id"]
            isOneToOne: true
            referencedRelation: "multishots"
            referencedColumns: ["id"]
          },
        ]
      }
      firework_editor_versions: {
        Row: {
          action: string
          changes_json: Json
          created_at: string
          created_by: string | null
          created_by_label: string
          firework_effect_id: string | null
          firework_id: string | null
          firework_style_default_id: string | null
          id: string
          previous_snapshot_json: Json | null
          snapshot_json: Json
          summary: string
          target_kind: string
        }
        Insert: {
          action: string
          changes_json?: Json
          created_at?: string
          created_by?: string | null
          created_by_label: string
          firework_effect_id?: string | null
          firework_id?: string | null
          firework_style_default_id?: string | null
          id?: string
          previous_snapshot_json?: Json | null
          snapshot_json: Json
          summary: string
          target_kind: string
        }
        Update: {
          action?: string
          changes_json?: Json
          created_at?: string
          created_by?: string | null
          created_by_label?: string
          firework_effect_id?: string | null
          firework_id?: string | null
          firework_style_default_id?: string | null
          id?: string
          previous_snapshot_json?: Json | null
          snapshot_json?: Json
          summary?: string
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "firework_editor_versions_firework_effect_id_fkey"
            columns: ["firework_effect_id"]
            isOneToOne: false
            referencedRelation: "firework_effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firework_editor_versions_firework_id_fkey"
            columns: ["firework_id"]
            isOneToOne: false
            referencedRelation: "fireworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firework_editor_versions_firework_style_default_id_fkey"
            columns: ["firework_style_default_id"]
            isOneToOne: false
            referencedRelation: "firework_style_defaults"
            referencedColumns: ["id"]
          },
        ]
      }
      firework_effects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          model_json: Json
          name: string
          pattern_key: string
          slug: string
          sort_order: number
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          model_json?: Json
          name: string
          pattern_key: string
          slug: string
          sort_order?: number
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          model_json?: Json
          name?: string
          pattern_key?: string
          slug?: string
          sort_order?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      firework_preview_images: {
        Row: {
          captured_at: string | null
          created_at: string
          firework_effect_id: string | null
          firework_id: string | null
          height: number | null
          id: string
          multishot_id: string | null
          renderer_version: string | null
          source_revision: number
          source_signature: string | null
          storage_path: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          captured_at?: string | null
          created_at?: string
          firework_effect_id?: string | null
          firework_id?: string | null
          height?: number | null
          id?: string
          multishot_id?: string | null
          renderer_version?: string | null
          source_revision?: number
          source_signature?: string | null
          storage_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          captured_at?: string | null
          created_at?: string
          firework_effect_id?: string | null
          firework_id?: string | null
          height?: number | null
          id?: string
          multishot_id?: string | null
          renderer_version?: string | null
          source_revision?: number
          source_signature?: string | null
          storage_path?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "firework_preview_images_firework_effect_id_fkey"
            columns: ["firework_effect_id"]
            isOneToOne: true
            referencedRelation: "firework_effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firework_preview_images_firework_id_fkey"
            columns: ["firework_id"]
            isOneToOne: true
            referencedRelation: "fireworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firework_preview_images_multishot_id_fkey"
            columns: ["multishot_id"]
            isOneToOne: true
            referencedRelation: "multishots"
            referencedColumns: ["id"]
          },
        ]
      }
      firework_style_defaults: {
        Row: {
          created_at: string
          defaults_json: Json
          description: string | null
          id: string
          is_archived: boolean
          kind: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          defaults_json?: Json
          description?: string | null
          id?: string
          is_archived?: boolean
          kind: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          defaults_json?: Json
          description?: string | null
          id?: string
          is_archived?: boolean
          kind?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      fireworks: {
        Row: {
          caliber: string | null
          color_palette: string[]
          confidence: number
          created_at: string
          description: string | null
          duration_seconds: number | null
          firework_effect_id: string
          height_meters: number | null
          id: string
          name: string
          primary_color: string | null
          render_overrides_json: Json
          secondary_color: string | null
          slug: string
          source: string
          updated_at: string
          variant_json: Json
        }
        Insert: {
          caliber?: string | null
          color_palette?: string[]
          confidence?: number
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          firework_effect_id: string
          height_meters?: number | null
          id?: string
          name: string
          primary_color?: string | null
          render_overrides_json?: Json
          secondary_color?: string | null
          slug: string
          source?: string
          updated_at?: string
          variant_json?: Json
        }
        Update: {
          caliber?: string | null
          color_palette?: string[]
          confidence?: number
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          firework_effect_id?: string
          height_meters?: number | null
          id?: string
          name?: string
          primary_color?: string | null
          render_overrides_json?: Json
          secondary_color?: string | null
          slug?: string
          source?: string
          updated_at?: string
          variant_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "firework_variants_effect_id_fkey"
            columns: ["firework_effect_id"]
            isOneToOne: false
            referencedRelation: "firework_effects"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_settings: {
        Row: {
          created_at: string
          generation_mode: string
          key: string
          product_catalogue_fields: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          generation_mode?: string
          key: string
          product_catalogue_fields?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          generation_mode?: string
          key?: string
          product_catalogue_fields?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          end_reason: string | null
          ended_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          return_token_hash: string
          started_at: string
          target_user_id: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          return_token_hash: string
          started_at?: string
          target_user_id: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          return_token_hash?: string
          started_at?: string
          target_user_id?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      import_candidate_render_validations: {
        Row: {
          artifact_output_id: string
          artifact_storage_path: string
          candidate_id: string
          canonical_evidence: Json
          created_at: string
          evidence_hash: string
          metrics_schema_version: string
          renderer_contract_version: string
          validator_version: string
        }
        Insert: {
          artifact_output_id: string
          artifact_storage_path: string
          candidate_id: string
          canonical_evidence: Json
          created_at?: string
          evidence_hash: string
          metrics_schema_version: string
          renderer_contract_version: string
          validator_version: string
        }
        Update: {
          artifact_output_id?: string
          artifact_storage_path?: string
          candidate_id?: string
          canonical_evidence?: Json
          created_at?: string
          evidence_hash?: string
          metrics_schema_version?: string
          renderer_contract_version?: string
          validator_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_candidate_render_validations_artifact_output_id_fkey"
            columns: ["artifact_output_id"]
            isOneToOne: false
            referencedRelation: "import_run_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_candidate_render_validations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      import_candidate_validations: {
        Row: {
          candidate_id: string
          canonical_reconstruction: Json
          content_hash: string
          created_at: string
          validator_version: string
        }
        Insert: {
          candidate_id: string
          canonical_reconstruction: Json
          content_hash: string
          created_at?: string
          validator_version: string
        }
        Update: {
          candidate_id?: string
          canonical_reconstruction?: Json
          content_hash?: string
          created_at?: string
          validator_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_candidate_validations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      import_candidates: {
        Row: {
          approved_at: string | null
          content_hash: string
          created_at: string
          id: string
          import_run_id: string
          metrics: Json
          ordinal: number
          reconstruction: Json
          rendered_video_path: string | null
          schema_version: string
          score: number
          selected_at: string | null
          validation: Json
        }
        Insert: {
          approved_at?: string | null
          content_hash: string
          created_at?: string
          id?: string
          import_run_id: string
          metrics?: Json
          ordinal: number
          reconstruction: Json
          rendered_video_path?: string | null
          schema_version: string
          score: number
          selected_at?: string | null
          validation?: Json
        }
        Update: {
          approved_at?: string | null
          content_hash?: string
          created_at?: string
          id?: string
          import_run_id?: string
          metrics?: Json
          ordinal?: number
          reconstruction?: Json
          rendered_video_path?: string | null
          schema_version?: string
          score?: number
          selected_at?: string | null
          validation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_candidates_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          active_run_id: string | null
          approval_request_hash: string | null
          approved_at: string | null
          approved_by: string | null
          approved_candidate_id: string | null
          approved_catalogue_item_id: string | null
          approved_run_id: string | null
          archived_at: string | null
          archived_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          kind: string
          media_asset_id: string | null
          processing_progress: number
          processor_version: string | null
          row_count: number | null
          selected_at: string | null
          selected_by: string | null
          selected_candidate_id: string | null
          selected_model: string | null
          source_name: string
          source_url: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          active_run_id?: string | null
          approval_request_hash?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_candidate_id?: string | null
          approved_catalogue_item_id?: string | null
          approved_run_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          kind: string
          media_asset_id?: string | null
          processing_progress?: number
          processor_version?: string | null
          row_count?: number | null
          selected_at?: string | null
          selected_by?: string | null
          selected_candidate_id?: string | null
          selected_model?: string | null
          source_name: string
          source_url?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          active_run_id?: string | null
          approval_request_hash?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_candidate_id?: string | null
          approved_catalogue_item_id?: string | null
          approved_run_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          kind?: string
          media_asset_id?: string | null
          processing_progress?: number
          processor_version?: string | null
          row_count?: number | null
          selected_at?: string | null
          selected_by?: string | null
          selected_candidate_id?: string | null
          selected_model?: string | null
          source_name?: string
          source_url?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_active_run_id_fkey"
            columns: ["active_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_approved_candidate_id_fkey"
            columns: ["approved_candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_approved_catalogue_item_id_fkey"
            columns: ["approved_catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_approved_run_id_fkey"
            columns: ["approved_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_selected_candidate_id_fkey"
            columns: ["selected_candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      import_outputs: {
        Row: {
          created_at: string
          id: string
          import_job_id: string
          output_type: string
          payload: Json
        }
        Insert: {
          created_at?: string
          id?: string
          import_job_id: string
          output_type: string
          payload: Json
        }
        Update: {
          created_at?: string
          id?: string
          import_job_id?: string
          output_type?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_outputs_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_run_outputs: {
        Row: {
          content_hash: string | null
          created_at: string
          id: string
          import_run_id: string
          output_type: string
          payload: Json
          schema_version: string
          sequence: number
          stage: string
          storage_path: string | null
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          id?: string
          import_run_id: string
          output_type: string
          payload: Json
          schema_version: string
          sequence: number
          stage: string
          storage_path?: string | null
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          id?: string
          import_run_id?: string
          output_type?: string
          payload?: Json
          schema_version?: string
          sequence?: number
          stage?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_run_outputs_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          attempt_number: number
          completed_at: string | null
          completion_lease_token: string | null
          completion_request_hash: string | null
          created_at: string
          created_by: string | null
          credit_action_key: string | null
          credit_reservation_key: string | null
          credit_status: string | null
          direct_dispatch_attempt_count: number
          direct_dispatch_call_id: string | null
          direct_dispatch_error: string | null
          direct_dispatch_status: string
          direct_dispatch_updated_at: string | null
          engine_schema_version: string
          error_message: string | null
          failure_lease_token: string | null
          failure_request_hash: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          import_job_id: string
          lease_expires_at: string | null
          lease_recovery_count: number
          lease_token: string | null
          modal_call_id: string | null
          model_snapshot: Json
          parent_run_id: string | null
          pipeline_version: string
          progress: number
          prompt_snapshot: Json
          request_kind: string
          request_prompt: string | null
          selected_model: string
          source_candidate_id: string | null
          source_sha256: string | null
          stage: string
          started_at: string | null
          status: string
          updated_at: string
          video_model: string | null
        }
        Insert: {
          attempt_number: number
          completed_at?: string | null
          completion_lease_token?: string | null
          completion_request_hash?: string | null
          created_at?: string
          created_by?: string | null
          credit_action_key?: string | null
          credit_reservation_key?: string | null
          credit_status?: string | null
          direct_dispatch_attempt_count?: number
          direct_dispatch_call_id?: string | null
          direct_dispatch_error?: string | null
          direct_dispatch_status?: string
          direct_dispatch_updated_at?: string | null
          engine_schema_version?: string
          error_message?: string | null
          failure_lease_token?: string | null
          failure_request_hash?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key: string
          import_job_id: string
          lease_expires_at?: string | null
          lease_recovery_count?: number
          lease_token?: string | null
          modal_call_id?: string | null
          model_snapshot?: Json
          parent_run_id?: string | null
          pipeline_version?: string
          progress?: number
          prompt_snapshot?: Json
          request_kind: string
          request_prompt?: string | null
          selected_model: string
          source_candidate_id?: string | null
          source_sha256?: string | null
          stage?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          video_model?: string | null
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          completion_lease_token?: string | null
          completion_request_hash?: string | null
          created_at?: string
          created_by?: string | null
          credit_action_key?: string | null
          credit_reservation_key?: string | null
          credit_status?: string | null
          direct_dispatch_attempt_count?: number
          direct_dispatch_call_id?: string | null
          direct_dispatch_error?: string | null
          direct_dispatch_status?: string
          direct_dispatch_updated_at?: string | null
          engine_schema_version?: string
          error_message?: string | null
          failure_lease_token?: string | null
          failure_request_hash?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string
          import_job_id?: string
          lease_expires_at?: string | null
          lease_recovery_count?: number
          lease_token?: string | null
          modal_call_id?: string | null
          model_snapshot?: Json
          parent_run_id?: string | null
          pipeline_version?: string
          progress?: number
          prompt_snapshot?: Json
          request_kind?: string
          request_prompt?: string | null
          selected_model?: string
          source_candidate_id?: string | null
          source_sha256?: string | null
          stage?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          video_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_runs_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_runs_parent_run_id_fkey"
            columns: ["parent_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_runs_source_candidate_id_fkey"
            columns: ["source_candidate_id"]
            isOneToOne: false
            referencedRelation: "import_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      jamendo_response_cache: {
        Row: {
          cache_key: string
          expires_at: string
          payload: Json
          updated_at: string
        }
        Insert: {
          cache_key: string
          expires_at: string
          payload: Json
          updated_at?: string
        }
        Update: {
          cache_key?: string
          expires_at?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          created_at: string
          duration_seconds: number | null
          height: number | null
          id: string
          metadata: Json | null
          mime_type: string | null
          owner_id: string | null
          source_type: string
          storage_path: string | null
          url: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          owner_id?: string | null
          source_type: string
          storage_path?: string | null
          url?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          owner_id?: string | null
          source_type?: string
          storage_path?: string | null
          url?: string | null
          width?: number | null
        }
        Relationships: []
      }
      multishot_fireworks: {
        Row: {
          caliber: string | null
          created_at: string
          firework_id: string
          id: string
          multishot_id: string
          notes: string | null
          pan_degrees: number
          position_override_json: Json | null
          sequence_index: number
          tilt_degrees: number
          time_offset_seconds: number
          timeline_track_index: number
        }
        Insert: {
          caliber?: string | null
          created_at?: string
          firework_id: string
          id?: string
          multishot_id: string
          notes?: string | null
          pan_degrees?: number
          position_override_json?: Json | null
          sequence_index: number
          tilt_degrees?: number
          time_offset_seconds?: number
          timeline_track_index?: number
        }
        Update: {
          caliber?: string | null
          created_at?: string
          firework_id?: string
          id?: string
          multishot_id?: string
          notes?: string | null
          pan_degrees?: number
          position_override_json?: Json | null
          sequence_index?: number
          tilt_degrees?: number
          time_offset_seconds?: number
          timeline_track_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "multishot_fireworks_firework_id_fkey"
            columns: ["firework_id"]
            isOneToOne: false
            referencedRelation: "fireworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "multishot_fireworks_multishot_id_fkey"
            columns: ["multishot_id"]
            isOneToOne: false
            referencedRelation: "multishots"
            referencedColumns: ["id"]
          },
        ]
      }
      multishots: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          metadata: Json
          name: string
          shot_count: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          metadata?: Json
          name: string
          shot_count?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          metadata?: Json
          name?: string
          shot_count?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      prompt_configs: {
        Row: {
          created_at: string
          description: string | null
          is_active: boolean
          key: string
          name: string
          product_context_text: string | null
          system_prompt_text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          key: string
          name: string
          product_context_text?: string | null
          system_prompt_text: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          key?: string
          name?: string
          product_context_text?: string | null
          system_prompt_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_configs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      show_generation_runs: {
        Row: {
          analysis_json: Json | null
          audio_path: string
          completed_at: string | null
          created_at: string
          cue_count: number | null
          cue_generation_error: string | null
          cue_generation_status: string
          error_message: string | null
          id: string
          llm_payload: Json | null
          markdown: string | null
          personality: string
          runner_version: string | null
          runtime_ms: number | null
          schema_version: string
          show_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_json?: Json | null
          audio_path?: string
          completed_at?: string | null
          created_at?: string
          cue_count?: number | null
          cue_generation_error?: string | null
          cue_generation_status?: string
          error_message?: string | null
          id?: string
          llm_payload?: Json | null
          markdown?: string | null
          personality?: string
          runner_version?: string | null
          runtime_ms?: number | null
          schema_version?: string
          show_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_json?: Json | null
          audio_path?: string
          completed_at?: string | null
          created_at?: string
          cue_count?: number | null
          cue_generation_error?: string | null
          cue_generation_status?: string
          error_message?: string | null
          id?: string
          llm_payload?: Json | null
          markdown?: string | null
          personality?: string
          runner_version?: string | null
          runtime_ms?: number | null
          schema_version?: string
          show_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_analyses_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_preset_like_counts: {
        Row: {
          like_count: number
          show_preset_id: string
        }
        Insert: {
          like_count?: number
          show_preset_id: string
        }
        Update: {
          like_count?: number
          show_preset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_preset_like_counts_show_preset_id_fkey"
            columns: ["show_preset_id"]
            isOneToOne: true
            referencedRelation: "show_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      show_preset_likes: {
        Row: {
          created_at: string
          show_preset_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          show_preset_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          show_preset_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_preset_likes_show_preset_id_fkey"
            columns: ["show_preset_id"]
            isOneToOne: false
            referencedRelation: "show_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      show_presets: {
        Row: {
          budget_cents: number | null
          composition_signature: string
          cover_image_path: string | null
          cover_shader: Json | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          effects_count: number
          id: string
          is_featured: boolean
          is_published: boolean
          mood_tags: string[]
          preview_cues: Json
          published_at: string | null
          slug: string
          sort_order: number
          source_show_id: string | null
          theme: string
          time_of_day: string | null
          title: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          budget_cents?: number | null
          composition_signature?: string
          cover_image_path?: string | null
          cover_shader?: Json | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effects_count?: number
          id?: string
          is_featured?: boolean
          is_published?: boolean
          mood_tags?: string[]
          preview_cues?: Json
          published_at?: string | null
          slug: string
          sort_order?: number
          source_show_id?: string | null
          theme: string
          time_of_day?: string | null
          title: string
          total_cents?: number
          updated_at?: string
        }
        Update: {
          budget_cents?: number | null
          composition_signature?: string
          cover_image_path?: string | null
          cover_shader?: Json | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effects_count?: number
          id?: string
          is_featured?: boolean
          is_published?: boolean
          mood_tags?: string[]
          preview_cues?: Json
          published_at?: string | null
          slug?: string
          sort_order?: number
          source_show_id?: string | null
          theme?: string
          time_of_day?: string | null
          title?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_presets_source_show_id_fkey"
            columns: ["source_show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_timeline_items: {
        Row: {
          catalogue_item_id: string
          created_at: string
          description: string
          emphasis: string
          id: string
          label: string | null
          launch_position_index: number
          layer: string | null
          locked: boolean
          position: number
          seed_override: number | null
          show_id: string
          time_seconds: number
          track: string | null
          updated_at: string
        }
        Insert: {
          catalogue_item_id: string
          created_at?: string
          description: string
          emphasis?: string
          id?: string
          label?: string | null
          launch_position_index?: number
          layer?: string | null
          locked?: boolean
          position: number
          seed_override?: number | null
          show_id: string
          time_seconds: number
          track?: string | null
          updated_at?: string
        }
        Update: {
          catalogue_item_id?: string
          created_at?: string
          description?: string
          emphasis?: string
          id?: string
          label?: string | null
          launch_position_index?: number
          layer?: string | null
          locked?: boolean
          position?: number
          seed_override?: number | null
          show_id?: string
          time_seconds?: number
          track?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_cues_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_timeline_items_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
        ]
      }
      show_assortment_items: {
        Row: {
          catalogue_item_id: string
          created_at: string
          quantity: number
          show_id: string
        }
        Insert: {
          catalogue_item_id: string
          created_at?: string
          quantity: number
          show_id: string
        }
        Update: {
          catalogue_item_id?: string
          created_at?: string
          quantity?: number
          show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_assortment_items_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_assortment_items_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          artist: string | null
          assortment_id: string | null
          assortment_song_selection_id: string | null
          audio_path: string | null
          budget_cents: number | null
          cover_image_path: string | null
          cover_shader: Json | null
          creation_source: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          effects_count: number
          firework_types: string[] | null
          generated_cue_count: number | null
          generation_attempt_count: number
          generation_completed_at: string | null
          generation_error: string | null
          generation_last_attempt_at: string | null
          generation_lease_expires_at: string | null
          generation_lease_token: string | null
          generation_next_retry_at: string | null
          generation_runtime_ms: number | null
          generation_started_at: string | null
          generation_status: string
          id: string
          launch_positions_json: Json
          location: string | null
          mood_tags: string[]
          music_analysis_id: string | null
          public_access_token_hash: string | null
          safety_meters: number | null
          selected_cue_model: string | null
          show_style: string
          site_width_feet: number | null
          slug: string
          song: string | null
          status: string
          sync_percent: number | null
          time_of_day: string | null
          title: string
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          artist?: string | null
          assortment_id?: string | null
          assortment_song_selection_id?: string | null
          audio_path?: string | null
          budget_cents?: number | null
          cover_image_path?: string | null
          cover_shader?: Json | null
          creation_source?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effects_count?: number
          firework_types?: string[] | null
          generated_cue_count?: number | null
          generation_attempt_count?: number
          generation_completed_at?: string | null
          generation_error?: string | null
          generation_last_attempt_at?: string | null
          generation_lease_expires_at?: string | null
          generation_lease_token?: string | null
          generation_next_retry_at?: string | null
          generation_runtime_ms?: number | null
          generation_started_at?: string | null
          generation_status?: string
          id?: string
          launch_positions_json?: Json
          location?: string | null
          mood_tags?: string[]
          music_analysis_id?: string | null
          public_access_token_hash?: string | null
          safety_meters?: number | null
          selected_cue_model?: string | null
          show_style?: string
          site_width_feet?: number | null
          slug: string
          song?: string | null
          status?: string
          sync_percent?: number | null
          time_of_day?: string | null
          title: string
          total_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          artist?: string | null
          assortment_id?: string | null
          assortment_song_selection_id?: string | null
          audio_path?: string | null
          budget_cents?: number | null
          cover_image_path?: string | null
          cover_shader?: Json | null
          creation_source?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effects_count?: number
          firework_types?: string[] | null
          generated_cue_count?: number | null
          generation_attempt_count?: number
          generation_completed_at?: string | null
          generation_error?: string | null
          generation_last_attempt_at?: string | null
          generation_lease_expires_at?: string | null
          generation_lease_token?: string | null
          generation_next_retry_at?: string | null
          generation_runtime_ms?: number | null
          generation_started_at?: string | null
          generation_status?: string
          id?: string
          launch_positions_json?: Json
          location?: string | null
          mood_tags?: string[]
          music_analysis_id?: string | null
          public_access_token_hash?: string | null
          safety_meters?: number | null
          selected_cue_model?: string | null
          show_style?: string
          site_width_feet?: number | null
          slug?: string
          song?: string | null
          status?: string
          sync_percent?: number | null
          time_of_day?: string | null
          title?: string
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shows_assortment_id_fkey"
            columns: ["assortment_id"]
            isOneToOne: false
            referencedRelation: "assortments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_assortment_song_selection_id_fkey"
            columns: ["assortment_song_selection_id"]
            isOneToOne: false
            referencedRelation: "assortment_song_selections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_music_analysis_id_fkey"
            columns: ["music_analysis_id"]
            isOneToOne: false
            referencedRelation: "song_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      song_analyses: {
        Row: {
          analysis_json: Json | null
          attempt_count: number
          audio_path: string
          completed_at: string | null
          content_type: string | null
          created_at: string
          error_message: string | null
          id: string
          last_attempt_at: string | null
          lease_expires_at: string | null
          lease_token: string | null
          markdown: string | null
          next_retry_at: string | null
          original_filename: string | null
          personality: string
          runner_version: string | null
          runtime_ms: number | null
          schema_version: string
          size_bytes: number | null
          source_artist: string | null
          source_licence_name: string | null
          source_licence_url: string | null
          source_provider: string | null
          source_title: string | null
          source_track_id: string | null
          source_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_json?: Json | null
          attempt_count?: number
          audio_path: string
          completed_at?: string | null
          content_type?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          markdown?: string | null
          next_retry_at?: string | null
          original_filename?: string | null
          personality?: string
          runner_version?: string | null
          runtime_ms?: number | null
          schema_version?: string
          size_bytes?: number | null
          source_artist?: string | null
          source_licence_name?: string | null
          source_licence_url?: string | null
          source_provider?: string | null
          source_title?: string | null
          source_track_id?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_json?: Json | null
          attempt_count?: number
          audio_path?: string
          completed_at?: string | null
          content_type?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          markdown?: string | null
          next_retry_at?: string | null
          original_filename?: string | null
          personality?: string
          runner_version?: string | null
          runtime_ms?: number | null
          schema_version?: string
          size_bytes?: number | null
          source_artist?: string | null
          source_licence_name?: string | null
          source_licence_url?: string | null
          source_provider?: string | null
          source_title?: string | null
          source_track_id?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      supplier_inventory_items: {
        Row: {
          available: boolean
          catalogue_item_id: string | null
          created_at: string
          currency: string
          id: string
          price_cents: number | null
          quantity_on_hand: number
          supplier_id: string
          supplier_sku: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          available?: boolean
          catalogue_item_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          price_cents?: number | null
          quantity_on_hand?: number
          supplier_id: string
          supplier_sku?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          available?: boolean
          catalogue_item_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          price_cents?: number | null
          quantity_on_hand?: number
          supplier_id?: string
          supplier_sku?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_inventory_items_catalogue_item_id_fkey"
            columns: ["catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_profiles: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          slug: string
          status: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          slug: string
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          slug?: string
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      user_permission_overrides: {
        Row: {
          assigned_by: string | null
          created_at: string
          enabled: boolean
          permission_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          enabled?: boolean
          permission_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          enabled?: boolean
          permission_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          status: string
          theme_preference: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          status?: string
          theme_preference?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          theme_preference?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_refinement_cue_and_settle_credits: {
        Args: {
          p_catalogue_item_id: string
          p_emphasis: string
          p_launch_position_index: number
          p_metadata?: Json
          p_position: number
          p_refinement_id: string
          p_show_id: string
          p_time_seconds: number
        }
        Returns: string
      }
      add_show_timeline_item: {
        Args: {
          p_catalogue_item_id: string
          p_emphasis: string
          p_launch_position_index: number
          p_show_id: string
          p_time_seconds: number
        }
        Returns: string
      }
      ai_credit_usage_payload: { Args: { p_user_id: string }; Returns: Json }
      append_firework_import_run_output: {
        Args: {
          p_content_hash?: string
          p_lease_token: string
          p_output_type: string
          p_payload: Json
          p_run_id: string
          p_schema_version: string
          p_sequence: number
          p_stage: string
          p_storage_path?: string
        }
        Returns: string
      }
      approve_firework_import_candidate: {
        Args: {
          p_candidate_id: string
          p_category?: string
          p_firework_type?: string
          p_job_id: string
          p_manufacturer?: string
          p_name: string
          p_part_number: string
        }
        Returns: {
          catalogue_item_id: string
          firework_ids: string[]
          multishot_id: string
        }[]
      }
      archive_firework_import_job: {
        Args: { p_job_id: string }
        Returns: string
      }
      begin_firework_import_dispatch: {
        Args: { p_run_id: string }
        Returns: boolean
      }
      check_firework_import_dispatch_ready: { Args: never; Returns: boolean }
      claim_cue_generation_attempt: {
        Args: {
          p_lease_seconds?: number
          p_max_attempts?: number
          p_show_id?: string
        }
        Returns: {
          attempt_count: number
          credit_action_key: string
          lease_token: string
          music_analysis_id: string
          selected_cue_model: string
          show_id: string
          show_style: string
          user_id: string
        }[]
      }
      claim_firework_import_run: {
        Args: {
          p_lease_seconds?: number
          p_processor_version: string
          p_requested_run_id?: string
        }
        Returns: {
          job_id: string
          lease_token: string
          parent_candidate: Json
          request_kind: string
          request_prompt: string
          run_id: string
          selected_model: string
          source_name: string
          storage_path: string
        }[]
      }
      claim_song_analysis_attempt: {
        Args: {
          p_analysis_id?: string
          p_lease_seconds?: number
          p_max_attempts?: number
        }
        Returns: {
          analysis_id: string
          attempt_count: number
          audio_path: string
          lease_token: string
          personality: string
          user_id: string
        }[]
      }
      complete_cue_generation_attempt: {
        Args: {
          p_cue_count: number
          p_lease_token: string
          p_runtime_ms: number
          p_show_id: string
        }
        Returns: boolean
      }
      complete_firework_import_run: {
        Args: {
          p_candidates: Json
          p_lease_token: string
          p_run_id: string
          p_selected_ordinal: number
        }
        Returns: string
      }
      complete_song_analysis_attempt: {
        Args: {
          p_analysis_id: string
          p_analysis_json: Json
          p_lease_token: string
          p_markdown: string
          p_runner_version: string
          p_runtime_ms: number
          p_schema_version: string
        }
        Returns: boolean
      }
      create_assortment_qr_show: {
        Args: {
          p_assortment_token: string
          p_cover_shader: Json
          p_credit_action_key: string
          p_generation_mode: string
          p_public_access_token_hash: string
          p_selected_cue_model: string | null
          p_selection_id: string
          p_source_show_id?: string | null
          p_title: string
        }
        Returns: Json
      }
      create_style_default_and_update_effect: {
        Args: {
          p_effect_description: string
          p_effect_id: string
          p_effect_name: string
          p_expected_updated_at: string
          p_model_json: Json
          p_pattern_key: string
          p_sort_order: number
          p_style_defaults_json: Json
          p_style_description: string
          p_style_kind: string
          p_style_name: string
          p_style_slug: string
        }
        Returns: Json
      }
      create_style_default_and_update_firework: {
        Args: {
          p_caliber: string
          p_color_palette: string[]
          p_duration_seconds: number
          p_expected_updated_at: string
          p_firework_description: string
          p_firework_effect_id: string
          p_firework_id: string
          p_firework_name: string
          p_height_meters: number
          p_primary_color: string
          p_render_overrides_json: Json
          p_secondary_color: string
          p_style_defaults_json: Json
          p_style_description: string
          p_style_kind: string
          p_style_name: string
          p_style_slug: string
        }
        Returns: Json
      }
      current_firework_import_render_validator_version: {
        Args: never
        Returns: string
      }
      current_firework_import_renderer_contract_version: {
        Args: never
        Returns: string
      }
      current_firework_import_validator_version: {
        Args: never
        Returns: string
      }
      current_user_access: { Args: never; Returns: Json }
      current_user_has_permission: {
        Args: { permission_key: string }
        Returns: boolean
      }
      current_user_is_active: { Args: never; Returns: boolean }
      delete_show_timeline_item: { Args: { p_cue_id: string }; Returns: string }
      discard_unused_song_analysis: {
        Args: { p_analysis_id: string; p_audio_path: string }
        Returns: Json
      }
      ensure_ai_credit_account: { Args: { p_user_id: string }; Returns: Json }
      ensure_assortment_public_link: {
        Args: { p_assortment_id: string }
        Returns: Json
      }
      expire_exhausted_cue_generations: {
        Args: { p_limit?: number; p_max_attempts?: number }
        Returns: {
          error_message: string
          show_id: string
          user_id: string
        }[]
      }
      expire_exhausted_song_analyses: {
        Args: { p_limit?: number; p_max_attempts?: number }
        Returns: {
          analysis_id: string
          error_message: string
          user_id: string
        }[]
      }
      fail_cue_generation_attempt: {
        Args: {
          p_dead_letter?: boolean
          p_error_message: string
          p_lease_token: string
          p_runtime_ms: number
          p_show_id: string
        }
        Returns: boolean
      }
      fail_firework_import_run: {
        Args: {
          p_error_message: string
          p_lease_token: string
          p_run_id: string
        }
        Returns: undefined
      }
      fail_song_analysis_attempt: {
        Args: {
          p_analysis_id: string
          p_error_message: string
          p_lease_token: string
          p_runtime_ms: number
        }
        Returns: boolean
      }
      fail_waiting_show_generation: {
        Args: { p_error_message: string; p_show_id: string }
        Returns: boolean
      }
      finalise_firework_video_import: {
        Args: {
          p_original_name: string
          p_reported_duration_seconds?: number
          p_selected_model: string
          p_source_name: string
          p_storage_path: string
        }
        Returns: {
          job_id: string
          run_id: string
        }[]
      }
      get_backend_lifecycle_health: { Args: never; Returns: Json }
      grant_ai_credits: {
        Args: {
          p_amount: number
          p_idempotency_key: string
          p_note: string
          p_user_id: string
        }
        Returns: Json
      }
      has_permission: {
        Args: { permission_key: string; target_user_id: string }
        Returns: boolean
      }
      heartbeat_firework_import_run: {
        Args: {
          p_lease_seconds?: number
          p_lease_token: string
          p_progress: number
          p_run_id: string
          p_stage: string
        }
        Returns: undefined
      }
      list_orphan_audio_objects: {
        Args: { p_grace_hours?: number; p_limit?: number }
        Returns: {
          audio_path: string
        }[]
      }
      lock_firework_import_lease: {
        Args: { p_lease_token: string; p_run_id: string }
        Returns: string
      }
      prepare_assortment_song_analysis: {
        Args: {
          p_analysis_id: string
          p_assortment_token: string
          p_selection_id: string
        }
        Returns: Json
      }
      prepare_assortment_jamendo_selection: {
        Args: {
          p_access_token_hash: string
          p_assortment_token: string
          p_audio_path: string
          p_content_type: string
          p_new_analysis_id: string
          p_original_filename: string
          p_reusable_analysis_id?: string | null
          p_selection_id: string
          p_size_bytes: number
          p_source_artist: string
          p_source_licence_name: string
          p_source_licence_url: string
          p_source_title: string
          p_source_track_id: string
          p_source_url: string
        }
        Returns: Json
      }
      purge_expired_song_analyses: {
        Args: { p_limit?: number; p_retention_days?: number }
        Returns: {
          analysis_id: string
          analysis_status: string
          audio_path: string
          user_id: string
        }[]
      }
      record_backend_dead_letter: {
        Args: {
          p_attempt_count: number
          p_metadata?: Json
          p_reason: string
          p_severity: string
          p_user_id: string
          p_work_key: string
          p_work_type: string
        }
        Returns: undefined
      }
      record_firework_import_dispatch_result: {
        Args: {
          p_attempt_count: number
          p_call_id?: string
          p_error?: string
          p_outcome: string
          p_run_id: string
        }
        Returns: string
      }
      record_firework_import_media_probe: {
        Args: {
          p_duration_seconds: number
          p_height: number
          p_lease_token: string
          p_normalized_preview?: Json
          p_run_id: string
          p_source_probe: Json
          p_width: number
        }
        Returns: string
      }
      record_firework_import_run_context: {
        Args: {
          p_engine_schema_version: string
          p_lease_token: string
          p_modal_call_id?: string
          p_model_snapshot: Json
          p_pipeline_version: string
          p_prompt_snapshot: Json
          p_run_id: string
          p_source_sha256: string
          p_video_model: string
        }
        Returns: undefined
      }
      refund_ai_credit_reservation: {
        Args: {
          p_idempotency_key: string
          p_metadata?: Json
          p_reservation_key: string
          p_user_id: string
        }
        Returns: Json
      }
      replace_show_timeline_items: {
        Args: { p_items: Json; p_show_id: string; p_user_id: string }
        Returns: number
      }
      reserve_ai_credits: {
        Args: {
          p_action_key: string
          p_amount: number
          p_idempotency_key: string
          p_metadata?: Json
          p_reference_id: string
          p_reference_type: string
          p_user_id: string
        }
        Returns: Json
      }
      resolve_backend_dead_letter: {
        Args: {
          p_dead_letter_id: string
          p_resolution_note: string
          p_status: string
        }
        Returns: boolean
      }
      resolve_reconciled_show_generation_credit: {
        Args: { p_outcome: string; p_reason: string; p_show_id: string }
        Returns: undefined
      }
      schedule_cue_generation_retry: {
        Args: {
          p_error_message: string
          p_lease_token: string
          p_retry_delay_seconds: number
          p_runtime_ms: number
          p_show_id: string
        }
        Returns: boolean
      }
      schedule_song_analysis_retry: {
        Args: {
          p_analysis_id: string
          p_error_message: string
          p_lease_token: string
          p_retry_delay_seconds: number
          p_runtime_ms: number
        }
        Returns: boolean
      }
      seal_firework_import_candidate: {
        Args: {
          p_candidate_id: string
          p_canonical_reconstruction: Json
          p_content_hash: string
          p_validator_version: string
        }
        Returns: string
      }
      seal_firework_import_render_validation: {
        Args: {
          p_artifact_storage_path: string
          p_candidate_id: string
          p_canonical_evidence: Json
          p_validator_version: string
        }
        Returns: string
      }
      select_firework_import_candidate: {
        Args: { p_candidate_id: string; p_job_id: string }
        Returns: string
      }
      set_user_permission_overrides: {
        Args: { p_overrides: Json; p_user_id: string }
        Returns: number
      }
      set_user_status: {
        Args: { p_status: string; p_user_id: string }
        Returns: string
      }
      settle_ai_credit_reservation: {
        Args: {
          p_idempotency_key: string
          p_metadata?: Json
          p_reservation_key: string
          p_user_id: string
        }
        Returns: Json
      }
      show_preset_composition_signature: {
        Args: { p_preview_cues: Json }
        Returns: string
      }
      start_firework_import_run: {
        Args: {
          p_idempotency_key: string
          p_job_id: string
          p_request_kind: string
          p_request_prompt?: string
          p_selected_model: string
        }
        Returns: {
          attempt_number: number
          completed_at: string | null
          completion_lease_token: string | null
          completion_request_hash: string | null
          created_at: string
          created_by: string | null
          credit_action_key: string | null
          credit_reservation_key: string | null
          credit_status: string | null
          direct_dispatch_attempt_count: number
          direct_dispatch_call_id: string | null
          direct_dispatch_error: string | null
          direct_dispatch_status: string
          direct_dispatch_updated_at: string | null
          engine_schema_version: string
          error_message: string | null
          failure_lease_token: string | null
          failure_request_hash: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string
          import_job_id: string
          lease_expires_at: string | null
          lease_recovery_count: number
          lease_token: string | null
          modal_call_id: string | null
          model_snapshot: Json
          parent_run_id: string | null
          pipeline_version: string
          progress: number
          prompt_snapshot: Json
          request_kind: string
          request_prompt: string | null
          selected_model: string
          source_candidate_id: string | null
          source_sha256: string | null
          stage: string
          started_at: string | null
          status: string
          updated_at: string
          video_model: string | null
        }
        SetofOptions: {
          from: "*"
          to: "import_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sync_multishot_derived_state: {
        Args: { p_multishot_id: string }
        Returns: Json
      }
      toggle_show_preset_like: {
        Args: { p_show_preset_id: string }
        Returns: Json
      }
      update_prompt_config_atomically: {
        Args: {
          p_key: string
          p_product_catalogue_fields?: Json
          p_product_context_text?: string
          p_system_prompt_text?: string
        }
        Returns: boolean
      }
      update_show_generation_mode: {
        Args: { p_generation_mode: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
