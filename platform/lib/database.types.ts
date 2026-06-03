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
      effect_specs: {
        Row: {
          confidence: number
          created_at: string
          description: string | null
          duration_seconds: number
          height_meters: number | null
          id: string
          name: string
          shot_count: number
          slug: string
          source: string
          spec_json: Json
          type: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          description?: string | null
          duration_seconds: number
          height_meters?: number | null
          id?: string
          name: string
          shot_count?: number
          slug: string
          source: string
          spec_json: Json
          type: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          description?: string | null
          duration_seconds?: number
          height_meters?: number | null
          id?: string
          name?: string
          shot_count?: number
          slug?: string
          source?: string
          spec_json?: Json
          type?: string
          updated_at?: string
        }
        Relationships: []
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
          updated_at?: string
        }
        Relationships: []
      }
      firework_variants: {
        Row: {
          caliber: string | null
          color_palette: string[]
          confidence: number
          created_at: string
          description: string | null
          duration_seconds: number | null
          effect_id: string
          height_meters: number | null
          id: string
          name: string
          primary_color: string | null
          render_overrides_json: Json
          secondary_color: string | null
          slug: string
          source: string
          source_effect_spec_id: string | null
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
          effect_id: string
          height_meters?: number | null
          id?: string
          name: string
          primary_color?: string | null
          render_overrides_json?: Json
          secondary_color?: string | null
          slug: string
          source?: string
          source_effect_spec_id?: string | null
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
          effect_id?: string
          height_meters?: number | null
          id?: string
          name?: string
          primary_color?: string | null
          render_overrides_json?: Json
          secondary_color?: string | null
          slug?: string
          source?: string
          source_effect_spec_id?: string | null
          updated_at?: string
          variant_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "firework_variants_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "firework_effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firework_variants_source_effect_spec_id_fkey"
            columns: ["source_effect_spec_id"]
            isOneToOne: true
            referencedRelation: "effect_specs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          approved_firework_specification_id: string | null
          approved_product_id: string | null
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
          approved_firework_specification_id?: string | null
          approved_product_id?: string | null
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
          approved_firework_specification_id?: string | null
          approved_product_id?: string | null
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
            foreignKeyName: "import_jobs_approved_product_id_fkey"
            columns: ["approved_product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      impersonation_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          ended_at: string | null
          end_reason: string | null
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
          ended_at?: string | null
          end_reason?: string | null
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
          ended_at?: string | null
          end_reason?: string | null
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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_shots: {
        Row: {
          caliber: string | null
          created_at: string | null
          effect_spec_id: string | null
          firework_variant_id: string | null
          id: string
          pan_degrees: number
          position_override_json: Json | null
          product_id: string
          shot_index: number
          shot_notes: string | null
          tilt_degrees: number
          time_offset_seconds: number
        }
        Insert: {
          caliber?: string | null
          created_at?: string | null
          effect_spec_id?: string | null
          firework_variant_id?: string | null
          id?: string
          pan_degrees?: number
          position_override_json?: Json | null
          product_id: string
          shot_index: number
          shot_notes?: string | null
          tilt_degrees?: number
          time_offset_seconds?: number
        }
        Update: {
          caliber?: string | null
          created_at?: string | null
          effect_spec_id?: string | null
          firework_variant_id?: string | null
          id?: string
          pan_degrees?: number
          position_override_json?: Json | null
          product_id?: string
          shot_index?: number
          shot_notes?: string | null
          tilt_degrees?: number
          time_offset_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_effect_sequences_effect_spec_id_fkey"
            columns: ["effect_spec_id"]
            isOneToOne: false
            referencedRelation: "effect_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_effect_sequences_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_shots_firework_variant_id_fkey"
            columns: ["firework_variant_id"]
            isOneToOne: false
            referencedRelation: "firework_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          id: string
          manufacturer: string | null
          name: string
          part_number: string
          product_kind: string
          product_metadata: Json
          subtype: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          manufacturer?: string | null
          name: string
          part_number: string
          product_kind?: string
          product_metadata?: Json
          subtype?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          id?: string
          manufacturer?: string | null
          name?: string
          part_number?: string
          product_kind?: string
          product_metadata?: Json
          subtype?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
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
      music_analyses: {
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
      show_analyses: {
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
          audio_path: string
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
      show_cues: {
        Row: {
          created_at: string
          description: string
          id: string
          label: string | null
          launch_position_index: number
          layer: string | null
          locked: boolean
          position: number
          product_id: string
          seed_override: number | null
          show_id: string
          time_seconds: number | null
          track: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          label?: string | null
          launch_position_index?: number
          layer?: string | null
          locked?: boolean
          position?: number
          product_id: string
          seed_override?: number | null
          show_id: string
          time_seconds?: number | null
          track?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          label?: string | null
          launch_position_index?: number
          layer?: string | null
          locked?: boolean
          position?: number
          product_id?: string
          seed_override?: number | null
          show_id?: string
          time_seconds?: number | null
          track?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_cues_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_cues_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_templates: {
        Row: {
          budget_cents: number | null
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
      shows: {
        Row: {
          artist: string | null
          audio_path: string | null
          budget_cents: number | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          effects_count: number
          generated_cue_count: number | null
          generation_completed_at: string | null
          generation_error: string | null
          generation_started_at: string | null
          generation_status: string
          id: string
          launch_positions_json: Json
          location: string | null
          music_analysis_id: string | null
          mood_tags: string[]
          safety_meters: number | null
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
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effects_count?: number
          generated_cue_count?: number | null
          generation_completed_at?: string | null
          generation_error?: string | null
          generation_started_at?: string | null
          generation_status?: string
          id?: string
          launch_positions_json?: Json
          location?: string | null
          music_analysis_id?: string | null
          mood_tags?: string[]
          safety_meters?: number | null
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
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effects_count?: number
          generated_cue_count?: number | null
          generation_completed_at?: string | null
          generation_error?: string | null
          generation_started_at?: string | null
          generation_status?: string
          id?: string
          launch_positions_json?: Json
          location?: string | null
          music_analysis_id?: string | null
          mood_tags?: string[]
          safety_meters?: number | null
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
            referencedRelation: "music_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_inventory_items: {
        Row: {
          available: boolean
          created_at: string
          currency: string
          id: string
          location_id: string | null
          price_cents: number | null
          product_id: string | null
          quantity_on_hand: number
          supplier_id: string
          supplier_sku: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          available?: boolean
          created_at?: string
          currency?: string
          id?: string
          location_id?: string | null
          price_cents?: number | null
          product_id?: string | null
          quantity_on_hand?: number
          supplier_id: string
          supplier_sku?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          available?: boolean
          created_at?: string
          currency?: string
          id?: string
          location_id?: string | null
          price_cents?: number | null
          product_id?: string | null
          quantity_on_hand?: number
          supplier_id?: string
          supplier_sku?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_inventory_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "supplier_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      has_permission: {
        Args: { permission_key: string; target_user_id: string }
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
