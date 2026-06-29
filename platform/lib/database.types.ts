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
          is_billable: boolean
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
          is_billable?: boolean
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
          is_billable?: boolean
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
      catalogue_items: {
        Row: {
          catalogue_item_kind: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          firework_id: string | null
          firework_type: string | null
          id: string
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
            isOneToOne: false
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
        ]
      }
      firework_effect_style_default_links: {
        Row: {
          created_at: string
          firework_effect_id: string
          kind: string
          style_default_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          firework_effect_id: string
          kind: string
          style_default_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          firework_effect_id?: string
          kind?: string
          style_default_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "firework_effect_style_default_links_firework_effect_id_fkey"
            columns: ["firework_effect_id"]
            isOneToOne: false
            referencedRelation: "firework_effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firework_effect_style_default_links_style_default_id_fkey"
            columns: ["style_default_id"]
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
          family: string
          id: string
          model_json: Json
          name: string
          pattern_key: string
          slug: string
          sort_order: number
          source: string
          star_style_default_id: string | null
          trail_style_default_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          family?: string
          id?: string
          model_json?: Json
          name: string
          pattern_key: string
          slug: string
          sort_order?: number
          source?: string
          star_style_default_id?: string | null
          trail_style_default_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          family?: string
          id?: string
          model_json?: Json
          name?: string
          pattern_key?: string
          slug?: string
          sort_order?: number
          source?: string
          star_style_default_id?: string | null
          trail_style_default_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "firework_effects_star_style_default_id_fkey"
            columns: ["star_style_default_id"]
            isOneToOne: false
            referencedRelation: "firework_style_defaults"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firework_effects_trail_style_default_id_fkey"
            columns: ["trail_style_default_id"]
            isOneToOne: false
            referencedRelation: "firework_style_defaults"
            referencedColumns: ["id"]
          },
        ]
      }
      firework_style_default_links: {
        Row: {
          created_at: string
          firework_id: string
          kind: string
          style_default_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          firework_id: string
          kind: string
          style_default_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          firework_id?: string
          kind?: string
          style_default_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "firework_style_default_links_firework_id_fkey"
            columns: ["firework_id"]
            isOneToOne: false
            referencedRelation: "fireworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firework_style_default_links_style_default_id_fkey"
            columns: ["style_default_id"]
            isOneToOne: false
            referencedRelation: "firework_style_defaults"
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
          star_style_default_id: string | null
          trail_style_default_id: string | null
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
          star_style_default_id?: string | null
          trail_style_default_id?: string | null
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
          star_style_default_id?: string | null
          trail_style_default_id?: string | null
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
          {
            foreignKeyName: "fireworks_star_style_default_id_fkey"
            columns: ["star_style_default_id"]
            isOneToOne: false
            referencedRelation: "firework_style_defaults"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fireworks_trail_style_default_id_fkey"
            columns: ["trail_style_default_id"]
            isOneToOne: false
            referencedRelation: "firework_style_defaults"
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
      import_jobs: {
        Row: {
          approved_catalogue_item_id: string | null
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
          selected_model: string | null
          source_name: string
          source_url: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_catalogue_item_id?: string | null
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
          selected_model?: string | null
          source_name: string
          source_url?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_catalogue_item_id?: string | null
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
          selected_model?: string | null
          source_name?: string
          source_url?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_approved_catalogue_item_id_fkey"
            columns: ["approved_catalogue_item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
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
      shopping_list_items: {
        Row: {
          created_at: string
          firework_part_number: string | null
          id: string
          name: string
          position: number
          price_cents: number
          qty: number
          show_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          firework_part_number?: string | null
          id?: string
          name: string
          position?: number
          price_cents?: number
          qty?: number
          show_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          firework_part_number?: string | null
          id?: string
          name?: string
          position?: number
          price_cents?: number
          qty?: number
          show_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_generation_runs: {
        Row: {
          analysis_json: Json | null
          analysis_storage_path: string | null
          audio_path: string
          compact_payload: Json | null
          completed_at: string | null
          created_at: string
          cue_count: number | null
          cue_generation_error: string | null
          cue_generation_status: string
          error_message: string | null
          id: string
          llm_payload: Json | null
          markdown: string | null
          markdown_storage_path: string | null
          personality: string
          personality_preset: string | null
          runner_version: string | null
          runtime_ms: number | null
          schema_version: string
          show_id: string
          source_audio_path: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_json?: Json | null
          analysis_storage_path?: string | null
          audio_path?: string
          compact_payload?: Json | null
          completed_at?: string | null
          created_at?: string
          cue_count?: number | null
          cue_generation_error?: string | null
          cue_generation_status?: string
          error_message?: string | null
          id?: string
          llm_payload?: Json | null
          markdown?: string | null
          markdown_storage_path?: string | null
          personality?: string
          personality_preset?: string | null
          runner_version?: string | null
          runtime_ms?: number | null
          schema_version?: string
          show_id: string
          source_audio_path?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_json?: Json | null
          analysis_storage_path?: string | null
          audio_path?: string
          compact_payload?: Json | null
          completed_at?: string | null
          created_at?: string
          cue_count?: number | null
          cue_generation_error?: string | null
          cue_generation_status?: string
          error_message?: string | null
          id?: string
          llm_payload?: Json | null
          markdown?: string | null
          markdown_storage_path?: string | null
          personality?: string
          personality_preset?: string | null
          runner_version?: string | null
          runtime_ms?: number | null
          schema_version?: string
          show_id?: string
          source_audio_path?: string | null
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
      show_presets: {
        Row: {
          budget_cents: number | null
          cover_shader: Json | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          effects_count: number
          id: string
          is_featured: boolean
          mood_tags: string[]
          preview_cues: Json
          slug: string
          sort_order: number
          theme: string
          time_of_day: string | null
          title: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          budget_cents?: number | null
          cover_shader?: Json | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effects_count?: number
          id?: string
          is_featured?: boolean
          mood_tags?: string[]
          preview_cues?: Json
          slug: string
          sort_order?: number
          theme: string
          time_of_day?: string | null
          title: string
          total_cents?: number
          updated_at?: string
        }
        Update: {
          budget_cents?: number | null
          cover_shader?: Json | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effects_count?: number
          id?: string
          is_featured?: boolean
          mood_tags?: string[]
          preview_cues?: Json
          slug?: string
          sort_order?: number
          theme?: string
          time_of_day?: string | null
          title?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: []
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
          time_seconds: number | null
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
          position?: number
          seed_override?: number | null
          show_id: string
          time_seconds?: number | null
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
          time_seconds?: number | null
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
      shows: {
        Row: {
          artist: string | null
          audio_path: string | null
          budget_cents: number | null
          cover_shader: Json | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          effects_count: number
          firework_types: string[] | null
          generated_cue_count: number | null
          generation_completed_at: string | null
          generation_error: string | null
          generation_started_at: string | null
          generation_status: string
          id: string
          launch_positions_json: Json
          location: string | null
          mood_tags: string[]
          music_analysis_id: string | null
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
          audio_path?: string | null
          budget_cents?: number | null
          cover_shader?: Json | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effects_count?: number
          firework_types?: string[] | null
          generated_cue_count?: number | null
          generation_completed_at?: string | null
          generation_error?: string | null
          generation_started_at?: string | null
          generation_status?: string
          id?: string
          launch_positions_json?: Json
          location?: string | null
          mood_tags?: string[]
          music_analysis_id?: string | null
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
          audio_path?: string | null
          budget_cents?: number | null
          cover_shader?: Json | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effects_count?: number
          firework_types?: string[] | null
          generated_cue_count?: number | null
          generation_completed_at?: string | null
          generation_error?: string | null
          generation_started_at?: string | null
          generation_status?: string
          id?: string
          launch_positions_json?: Json
          location?: string | null
          mood_tags?: string[]
          music_analysis_id?: string | null
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
          audio_path: string
          completed_at: string | null
          content_type: string | null
          created_at: string
          error_message: string | null
          id: string
          markdown: string | null
          original_filename: string | null
          personality: string
          runner_version: string | null
          runtime_ms: number | null
          schema_version: string
          size_bytes: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_json?: Json | null
          audio_path: string
          completed_at?: string | null
          content_type?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          markdown?: string | null
          original_filename?: string | null
          personality?: string
          runner_version?: string | null
          runtime_ms?: number | null
          schema_version?: string
          size_bytes?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_json?: Json | null
          audio_path?: string
          completed_at?: string | null
          content_type?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          markdown?: string | null
          original_filename?: string | null
          personality?: string
          runner_version?: string | null
          runtime_ms?: number | null
          schema_version?: string
          size_bytes?: number | null
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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
            foreignKeyName: "supplier_inventory_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "supplier_locations"
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
      supplier_locations: {
        Row: {
          address: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          region: string | null
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          region?: string | null
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          region?: string | null
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_locations_supplier_id_fkey"
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
          last_seen_at: string | null
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
          last_seen_at?: string | null
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
          last_seen_at?: string | null
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
      current_user_access: { Args: never; Returns: Json }
      current_user_has_permission: {
        Args: { permission_key: string }
        Returns: boolean
      }
      ai_credit_usage_payload: {
        Args: { p_user_id: string }
        Returns: Json
      }
      ensure_ai_credit_account: {
        Args: { p_user_id: string }
        Returns: Json
      }
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
      settle_ai_credit_reservation: {
        Args: {
          p_idempotency_key: string
          p_metadata?: Json
          p_reservation_key: string
          p_user_id: string
        }
        Returns: Json
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
