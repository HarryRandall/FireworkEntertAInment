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
      catalogue_products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          effect_spec_id: string | null
          firework_type: string | null
          id: string
          manufacturer: string | null
          name: string
          part_number: string
          source_payload: Json | null
          source_table: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effect_spec_id?: string | null
          firework_type?: string | null
          id?: string
          manufacturer?: string | null
          name: string
          part_number: string
          source_payload?: Json | null
          source_table?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          effect_spec_id?: string | null
          firework_type?: string | null
          id?: string
          manufacturer?: string | null
          name?: string
          part_number?: string
          source_payload?: Json | null
          source_table?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_products_effect_spec_id_fkey"
            columns: ["effect_spec_id"]
            isOneToOne: false
            referencedRelation: "effect_specs"
            referencedColumns: ["id"]
          },
        ]
      }
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
      "Finale3D CSV Import Sample": {
        Row: {
          available: string | null
          category: string | null
          ceNumber: string | null
          color: string | null
          customPartField: string | null
          description: string | null
          dmxFixtureDefinition: string | null
          dmxPatch: string | null
          duration: number | null
          ematches: string | null
          exNumber: string | null
          fuseDelay: string | null
          height: number | null
          internalDelay: number | null
          lockoutDefault: string | null
          manufacturer: string | null
          manufacturerPartNumber: string | null
          neq: string | null
          numDevices: number | null
          numTubes: string | null
          partNotes: string | null
          partNumber: string
          partType: string | null
          physicalSpecifications: string | null
          qoh: string | null
          rackType: string | null
          safetyDistance: string | null
          size: string | null
          stdCost: string | null
          stdLocation: string | null
          stdPrice: string | null
          subtype: string | null
          unNumber: string | null
          vdl: string | null
          weight: string | null
        }
        Insert: {
          available?: string | null
          category?: string | null
          ceNumber?: string | null
          color?: string | null
          customPartField?: string | null
          description?: string | null
          dmxFixtureDefinition?: string | null
          dmxPatch?: string | null
          duration?: number | null
          ematches?: string | null
          exNumber?: string | null
          fuseDelay?: string | null
          height?: number | null
          internalDelay?: number | null
          lockoutDefault?: string | null
          manufacturer?: string | null
          manufacturerPartNumber?: string | null
          neq?: string | null
          numDevices?: number | null
          numTubes?: string | null
          partNotes?: string | null
          partNumber: string
          partType?: string | null
          physicalSpecifications?: string | null
          qoh?: string | null
          rackType?: string | null
          safetyDistance?: string | null
          size?: string | null
          stdCost?: string | null
          stdLocation?: string | null
          stdPrice?: string | null
          subtype?: string | null
          unNumber?: string | null
          vdl?: string | null
          weight?: string | null
        }
        Update: {
          available?: string | null
          category?: string | null
          ceNumber?: string | null
          color?: string | null
          customPartField?: string | null
          description?: string | null
          dmxFixtureDefinition?: string | null
          dmxPatch?: string | null
          duration?: number | null
          ematches?: string | null
          exNumber?: string | null
          fuseDelay?: string | null
          height?: number | null
          internalDelay?: number | null
          lockoutDefault?: string | null
          manufacturer?: string | null
          manufacturerPartNumber?: string | null
          neq?: string | null
          numDevices?: number | null
          numTubes?: string | null
          partNotes?: string | null
          partNumber?: string
          partType?: string | null
          physicalSpecifications?: string | null
          qoh?: string | null
          rackType?: string | null
          safetyDistance?: string | null
          size?: string | null
          stdCost?: string | null
          stdLocation?: string | null
          stdPrice?: string | null
          subtype?: string | null
          unNumber?: string | null
          vdl?: string | null
          weight?: string | null
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          approved_catalogue_product_id: string | null
          approved_firework_specification_id: string | null
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
          approved_catalogue_product_id?: string | null
          approved_firework_specification_id?: string | null
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
          approved_catalogue_product_id?: string | null
          approved_firework_specification_id?: string | null
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
            foreignKeyName: "import_jobs_approved_catalogue_product_id_fkey"
            columns: ["approved_catalogue_product_id"]
            isOneToOne: false
            referencedRelation: "catalogue_products"
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
      inferred_video_observations: {
        Row: {
          confidence: number
          created_at: string
          effect_spec_id: string | null
          id: string
          observation_json: Json
          video_id: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string
          effect_spec_id?: string | null
          id?: string
          observation_json: Json
          video_id?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          effect_spec_id?: string | null
          id?: string
          observation_json?: Json
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inferred_video_observations_effect_spec_id_fkey"
            columns: ["effect_spec_id"]
            isOneToOne: false
            referencedRelation: "effect_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inferred_video_observations_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
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
      products: {
        Row: {
          caliber: string | null
          category: string | null
          created_at: string
          default_effect_spec_id: string | null
          description: string | null
          duration_seconds: number | null
          height_meters: number | null
          id: string
          manufacturer: string | null
          media_references: Json
          name: string
          product_code: string | null
          product_dimensions: Json
          safety_distance_meters: number | null
          shot_count: number | null
          subtype: string | null
          tags: string[]
          updated_at: string
          vdl_like_description: string | null
          width_meters: number | null
        }
        Insert: {
          caliber?: string | null
          category?: string | null
          created_at?: string
          default_effect_spec_id?: string | null
          description?: string | null
          duration_seconds?: number | null
          height_meters?: number | null
          id?: string
          manufacturer?: string | null
          media_references?: Json
          name: string
          product_code?: string | null
          product_dimensions?: Json
          safety_distance_meters?: number | null
          shot_count?: number | null
          subtype?: string | null
          tags?: string[]
          updated_at?: string
          vdl_like_description?: string | null
          width_meters?: number | null
        }
        Update: {
          caliber?: string | null
          category?: string | null
          created_at?: string
          default_effect_spec_id?: string | null
          description?: string | null
          duration_seconds?: number | null
          height_meters?: number | null
          id?: string
          manufacturer?: string | null
          media_references?: Json
          name?: string
          product_code?: string | null
          product_dimensions?: Json
          safety_distance_meters?: number | null
          shot_count?: number | null
          subtype?: string | null
          tags?: string[]
          updated_at?: string
          vdl_like_description?: string | null
          width_meters?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_default_effect_spec_id_fkey"
            columns: ["default_effect_spec_id"]
            isOneToOne: false
            referencedRelation: "effect_specs"
            referencedColumns: ["id"]
          },
        ]
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
      show_cues: {
        Row: {
          created_at: string
          description: string
          effect_spec_id: string | null
          firework_product_id: string | null
          id: string
          label: string | null
          launch_position_index: number
          layer: string | null
          locked: boolean
          overrides_json: Json
          position: number
          position_json: Json
          render_params: Json | null
          rotation_json: Json
          scale: number
          seed_override: number | null
          show_id: string
          time_seconds: number | null
          track: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          effect_spec_id?: string | null
          firework_product_id?: string | null
          id?: string
          label?: string | null
          launch_position_index?: number
          layer?: string | null
          locked?: boolean
          overrides_json?: Json
          position?: number
          position_json?: Json
          render_params?: Json | null
          rotation_json?: Json
          scale?: number
          seed_override?: number | null
          show_id: string
          time_seconds?: number | null
          track?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          effect_spec_id?: string | null
          firework_product_id?: string | null
          id?: string
          label?: string | null
          launch_position_index?: number
          layer?: string | null
          locked?: boolean
          overrides_json?: Json
          position?: number
          position_json?: Json
          render_params?: Json | null
          rotation_json?: Json
          scale?: number
          seed_override?: number | null
          show_id?: string
          time_seconds?: number | null
          track?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_cues_effect_spec_id_fkey"
            columns: ["effect_spec_id"]
            isOneToOne: false
            referencedRelation: "effect_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_cues_firework_product_id_fkey"
            columns: ["firework_product_id"]
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
          id: string
          launch_positions_json: Json
          location: string | null
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
          id?: string
          launch_positions_json?: Json
          location?: string | null
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
          id?: string
          launch_positions_json?: Json
          location?: string | null
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
        Relationships: []
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
            referencedRelation: "catalogue_products"
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
      vdl_terms: {
        Row: {
          created_at: string
          description: string | null
          example_vdl_phrase: string | null
          id: string
          term: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          example_vdl_phrase?: string | null
          id?: string
          term: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          example_vdl_phrase?: string | null
          id?: string
          term?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      "Wikifireworks sample database": {
        Row: {
          "BARCODE 1 (optional)": string | null
          "BARCODE 2 (optional)": string | null
          DESCRIPTION: string | null
          DURATION: number | null
          "FIREWORK TYPE": string | null
          "IMAGE URL": string | null
          NAME: string | null
          "PART NUMBER": string
          "PRO USE": boolean | null
          "QR CODE (optional)": string | null
          "WEBSITE URL": string | null
          "YOUTUBE URL": string | null
        }
        Insert: {
          "BARCODE 1 (optional)"?: string | null
          "BARCODE 2 (optional)"?: string | null
          DESCRIPTION?: string | null
          DURATION?: number | null
          "FIREWORK TYPE"?: string | null
          "IMAGE URL"?: string | null
          NAME?: string | null
          "PART NUMBER": string
          "PRO USE"?: boolean | null
          "QR CODE (optional)"?: string | null
          "WEBSITE URL"?: string | null
          "YOUTUBE URL"?: string | null
        }
        Update: {
          "BARCODE 1 (optional)"?: string | null
          "BARCODE 2 (optional)"?: string | null
          DESCRIPTION?: string | null
          DURATION?: number | null
          "FIREWORK TYPE"?: string | null
          "IMAGE URL"?: string | null
          NAME?: string | null
          "PART NUMBER"?: string
          "PRO USE"?: boolean | null
          "QR CODE (optional)"?: string | null
          "WEBSITE URL"?: string | null
          "YOUTUBE URL"?: string | null
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
