export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      branding: {
        Row: {
          accent: string | null
          created_at: string
          footer: string | null
          id: string
          logo_media_id: string | null
          organisation_id: string
          store_id: string | null
          theme: string
          updated_at: string
          welcome: string | null
        }
        Insert: {
          accent?: string | null
          created_at?: string
          footer?: string | null
          id?: string
          logo_media_id?: string | null
          organisation_id: string
          store_id?: string | null
          theme?: string
          updated_at?: string
          welcome?: string | null
        }
        Update: {
          accent?: string | null
          created_at?: string
          footer?: string | null
          id?: string
          logo_media_id?: string | null
          organisation_id?: string
          store_id?: string | null
          theme?: string
          updated_at?: string
          welcome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_logo_media_fk"
            columns: ["logo_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branding_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branding_organisation_id_store_id_fkey"
            columns: ["organisation_id", "store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      campaigns: {
        Row: {
          archived_at: string | null
          created_at: string
          ends_on: string | null
          id: string
          name: string
          organisation_id: string
          sale_period_id: string | null
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name: string
          organisation_id: string
          sale_period_id?: string | null
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name?: string
          organisation_id?: string
          sale_period_id?: string | null
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_sale_period_id_fkey"
            columns: ["sale_period_id"]
            isOneToOne: false
            referencedRelation: "sale_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          collection_id: string
          created_at: string
          organisation_id: string
          product_id: string
          sort: number
          updated_at: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          organisation_id: string
          product_id: string
          sort?: number
          updated_at?: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          organisation_id?: string
          product_id?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_organisation_id_collection_id_fkey"
            columns: ["organisation_id", "collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "collection_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_organisation_id_product_id_fkey"
            columns: ["organisation_id", "product_id"]
            isOneToOne: false
            referencedRelation: "range_items"
            referencedColumns: ["organisation_id", "product_id"]
          },
          {
            foreignKeyName: "collection_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          kind: string
          name: string
          organisation_id: string
          rule: Json | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind: string
          name: string
          organisation_id: string
          rule?: Json | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          organisation_id?: string
          rule?: Json | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      design_candidates: {
        Row: {
          analysis_id: string
          created_at: string
          id: string
          model: string | null
          overall: number | null
          parent_id: string | null
          proposal: Json
          renderer: string
          scores: Json
          source: string
          updated_at: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          id?: string
          model?: string | null
          overall?: number | null
          parent_id?: string | null
          proposal: Json
          renderer: string
          scores?: Json
          source: string
          updated_at?: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          id?: string
          model?: string | null
          overall?: number | null
          parent_id?: string | null
          proposal?: Json
          renderer?: string
          scores?: Json
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_candidates_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "video_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_candidates_analysis_id_parent_id_fkey"
            columns: ["analysis_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "design_candidates"
            referencedColumns: ["analysis_id", "id"]
          },
        ]
      }
      effect_versions: {
        Row: {
          author_id: string | null
          change_note: string | null
          checks: Json
          created_at: string
          design: Json
          design_schema: number
          effect_id: string
          id: string
          number: number
          parent_version_id: string | null
          published_at: string | null
          published_by: string | null
          reference_media_id: string | null
          renderer: string
          status: string
          submitted_at: string | null
          summary: Json
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          change_note?: string | null
          checks?: Json
          created_at?: string
          design: Json
          design_schema?: number
          effect_id: string
          id?: string
          number: number
          parent_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          reference_media_id?: string | null
          renderer: string
          status?: string
          submitted_at?: string | null
          summary?: Json
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          change_note?: string | null
          checks?: Json
          created_at?: string
          design?: Json
          design_schema?: number
          effect_id?: string
          id?: string
          number?: number
          parent_version_id?: string | null
          published_at?: string | null
          published_by?: string | null
          reference_media_id?: string | null
          renderer?: string
          status?: string
          submitted_at?: string | null
          summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "effect_versions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effect_versions_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effect_versions_effect_id_parent_version_id_fkey"
            columns: ["effect_id", "parent_version_id"]
            isOneToOne: false
            referencedRelation: "effect_versions"
            referencedColumns: ["effect_id", "id"]
          },
          {
            foreignKeyName: "effect_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effect_versions_reference_media_id_fkey"
            columns: ["reference_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      effects: {
        Row: {
          apex_m: number | null
          archived_at: string | null
          colours: string[]
          created_at: string
          created_by: string | null
          current_version_id: string | null
          draft_version_id: string | null
          duration_ms: number | null
          family: string
          id: string
          is_template: boolean
          kind: string
          name: string
          noise_level: number | null
          slug: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          apex_m?: number | null
          archived_at?: string | null
          colours?: string[]
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          draft_version_id?: string | null
          duration_ms?: number | null
          family: string
          id?: string
          is_template?: boolean
          kind: string
          name: string
          noise_level?: number | null
          slug: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          apex_m?: number | null
          archived_at?: string | null
          colours?: string[]
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          draft_version_id?: string | null
          duration_ms?: number | null
          family?: string
          id?: string
          is_template?: boolean
          kind?: string
          name?: string
          noise_level?: number | null
          slug?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "effects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effects_current_version_fk"
            columns: ["id", "current_version_id"]
            isOneToOne: false
            referencedRelation: "effect_versions"
            referencedColumns: ["effect_id", "id"]
          },
          {
            foreignKeyName: "effects_draft_version_fk"
            columns: ["id", "draft_version_id"]
            isOneToOne: false
            referencedRelation: "effect_versions"
            referencedColumns: ["effect_id", "id"]
          },
        ]
      }
      follows: {
        Row: {
          consent_text_version: string
          consented_at: string
          created_at: string
          marketing_opt_in: boolean
          organisation_id: string
          shopper_id: string
          updated_at: string
          visible_to_shop: boolean
        }
        Insert: {
          consent_text_version: string
          consented_at?: string
          created_at?: string
          marketing_opt_in?: boolean
          organisation_id: string
          shopper_id: string
          updated_at?: string
          visible_to_shop?: boolean
        }
        Update: {
          consent_text_version?: string
          consented_at?: string
          created_at?: string
          marketing_opt_in?: boolean
          organisation_id?: string
          shopper_id?: string
          updated_at?: string
          visible_to_shop?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "follows_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_lines: {
        Row: {
          confidence: number | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          import_id: string
          note: string | null
          raw: Json
          row_number: number
          state: string
          suggested_product_id: string | null
          supplier_product_id: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          import_id: string
          note?: string | null
          raw: Json
          row_number: number
          state: string
          suggested_product_id?: string | null
          supplier_product_id?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          import_id?: string
          note?: string | null
          raw?: Json
          row_number?: number
          state?: string
          suggested_product_id?: string | null
          supplier_product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_lines_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_lines_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_lines_suggested_product_id_fkey"
            columns: ["suggested_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_lines_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          counts: Json
          created_at: string
          error: string | null
          id: string
          mapping: Json
          media_id: string
          published_at: string | null
          stage: string
          submitted_by: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          counts?: Json
          created_at?: string
          error?: string | null
          id?: string
          mapping?: Json
          media_id: string
          published_at?: string | null
          stage?: string
          submitted_by?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          counts?: Json
          created_at?: string
          error?: string | null
          id?: string
          mapping?: Json
          media_id?: string
          published_at?: string | null
          stage?: string
          submitted_by?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imports_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imports_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imports_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organisation_id: string
          revoked_at: string | null
          role: string
          store_ids: string[] | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          organisation_id: string
          revoked_at?: string | null
          role: string
          store_ids?: string[] | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organisation_id?: string
          revoked_at?: string | null
          role?: string
          store_ids?: string[] | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      label_batches: {
        Row: {
          copies: number
          created_at: string
          created_by: string | null
          id: string
          organisation_id: string
          pdf_media_id: string | null
          qr_code_ids: string[]
          size: string
          updated_at: string
        }
        Insert: {
          copies?: number
          created_at?: string
          created_by?: string | null
          id?: string
          organisation_id: string
          pdf_media_id?: string | null
          qr_code_ids: string[]
          size: string
          updated_at?: string
        }
        Update: {
          copies?: number
          created_at?: string
          created_by?: string | null
          id?: string
          organisation_id?: string
          pdf_media_id?: string | null
          qr_code_ids?: string[]
          size?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_batches_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_batches_pdf_media_id_fkey"
            columns: ["pdf_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          created_at: string
          currency: string
          list_id: string
          product_id: string
          quantity: number
          unit_price_minor: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency: string
          list_id: string
          product_id: string
          quantity?: number
          unit_price_minor: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          list_id?: string
          product_id?: string
          quantity?: number
          unit_price_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          id: string
          plan_candidate_id: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          shopper_id: string
          status: string
          store_id: string
          till_code: string
          updated_at: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_candidate_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          shopper_id: string
          status?: string
          store_id: string
          till_code: string
          updated_at?: string
          valid_until: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_candidate_id?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          shopper_id?: string
          status?: string
          store_id?: string
          till_code?: string
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_plan_candidate_id_fkey"
            columns: ["plan_candidate_id"]
            isOneToOne: false
            referencedRelation: "plan_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lists_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lists_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lists_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "show_store_status"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "lists_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          code: string
          created_at: string
          currency: string
          enabled: boolean
          licence_note: string | null
          locale: string
          min_age: number
          name: string
          regions: string[]
          timezone: string
          units: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency: string
          enabled?: boolean
          licence_note?: string | null
          locale: string
          min_age: number
          name: string
          regions?: string[]
          timezone: string
          units: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          enabled?: boolean
          licence_note?: string | null
          locale?: string
          min_age?: number
          name?: string
          regions?: string[]
          timezone?: string
          units?: string
          updated_at?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          bucket: string
          bytes: number
          created_at: string
          duration_ms: number | null
          fps: number | null
          height: number | null
          id: string
          kind: string
          mime: string
          organisation_id: string | null
          path: string
          sha256: string
          supplier_id: string | null
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          bucket: string
          bytes: number
          created_at?: string
          duration_ms?: number | null
          fps?: number | null
          height?: number | null
          id?: string
          kind: string
          mime: string
          organisation_id?: string | null
          path: string
          sha256: string
          supplier_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          bucket?: string
          bytes?: number
          created_at?: string
          duration_ms?: number | null
          fps?: number | null
          height?: number | null
          id?: string
          kind?: string
          mime?: string
          organisation_id?: string | null
          path?: string
          sha256?: string
          supplier_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_supplier_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          organisation_id: string
          profile_id: string
          role: string
          store_ids: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          organisation_id: string
          profile_id: string
          role: string
          store_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          organisation_id?: string
          profile_id?: string
          role?: string
          store_ids?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      music_analyses: {
        Row: {
          algorithm: string
          analysis: Json
          audio_sha256: string
          created_at: string
          id: string
          is_current: boolean
          reviewed_by: string | null
          track_id: string
          updated_at: string
        }
        Insert: {
          algorithm: string
          analysis: Json
          audio_sha256: string
          created_at?: string
          id?: string
          is_current?: boolean
          reviewed_by?: string | null
          track_id: string
          updated_at?: string
        }
        Update: {
          algorithm?: string
          analysis?: Json
          audio_sha256?: string
          created_at?: string
          id?: string
          is_current?: boolean
          reviewed_by?: string | null
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_analyses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_analyses_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "music_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      music_tracks: {
        Row: {
          artist: string | null
          attribution: string | null
          audio_media_id: string | null
          bpm: number | null
          commercial_use: boolean
          created_at: string
          duration_ms: number
          genres: string[]
          id: string
          licence_code: string
          licence_url: string | null
          moods: string[]
          preview_media_id: string | null
          provider: string
          provider_track_id: string | null
          public_performance: string | null
          status: string
          title: string
          updated_at: string
          waveform: Json | null
        }
        Insert: {
          artist?: string | null
          attribution?: string | null
          audio_media_id?: string | null
          bpm?: number | null
          commercial_use?: boolean
          created_at?: string
          duration_ms: number
          genres?: string[]
          id?: string
          licence_code: string
          licence_url?: string | null
          moods?: string[]
          preview_media_id?: string | null
          provider: string
          provider_track_id?: string | null
          public_performance?: string | null
          status?: string
          title: string
          updated_at?: string
          waveform?: Json | null
        }
        Update: {
          artist?: string | null
          attribution?: string | null
          audio_media_id?: string | null
          bpm?: number | null
          commercial_use?: boolean
          created_at?: string
          duration_ms?: number
          genres?: string[]
          id?: string
          licence_code?: string
          licence_url?: string | null
          moods?: string[]
          preview_media_id?: string | null
          provider?: string
          provider_track_id?: string | null
          public_performance?: string | null
          status?: string
          title?: string
          updated_at?: string
          waveform?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "music_tracks_audio_media_id_fkey"
            columns: ["audio_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_tracks_preview_media_id_fkey"
            columns: ["preview_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_markets: {
        Row: {
          created_at: string
          market: string
          organisation_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          market: string
          organisation_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          market?: string
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_markets_market_fkey"
            columns: ["market"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "organisation_markets_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          archived_at: string | null
          billing_currency: string
          created_at: string
          home_market: string
          id: string
          kind: string | null
          name: string
          onboarding: Json
          slug: string
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          archived_at?: string | null
          billing_currency: string
          created_at?: string
          home_market: string
          id?: string
          kind?: string | null
          name: string
          onboarding?: Json
          slug: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          archived_at?: string | null
          billing_currency?: string
          created_at?: string
          home_market?: string
          id?: string
          kind?: string | null
          name?: string
          onboarding?: Json
          slug?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisations_home_market_fkey"
            columns: ["home_market"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
        ]
      }
      pack_items: {
        Row: {
          created_at: string
          item_id: string
          pack_id: string
          quantity: number
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          item_id: string
          pack_id: string
          quantity: number
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          item_id?: string
          pack_id?: string
          quantity?: number
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_candidates: {
        Row: {
          blurb: string | null
          created_at: string
          cues: Json
          currency: string
          duration_ms: number
          id: string
          mood: string | null
          name: string | null
          picked_at: string | null
          rank: number
          revision: number
          scores: Json
          session_id: string
          total_minor: number
          updated_at: string
        }
        Insert: {
          blurb?: string | null
          created_at?: string
          cues: Json
          currency: string
          duration_ms: number
          id?: string
          mood?: string | null
          name?: string | null
          picked_at?: string | null
          rank: number
          revision?: number
          scores?: Json
          session_id: string
          total_minor: number
          updated_at?: string
        }
        Update: {
          blurb?: string | null
          created_at?: string
          cues?: Json
          currency?: string
          duration_ms?: number
          id?: string
          mood?: string | null
          name?: string | null
          picked_at?: string | null
          rank?: number
          revision?: number
          scores?: Json
          session_id?: string
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_candidates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "plan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_edits: {
        Row: {
          candidate_id: string
          created_at: string
          diff: Json | null
          id: string
          llm_call_id: number | null
          message: string | null
          ops: Json
          outcome: string
          reply: string | null
          seq: number
          session_id: string
          source: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          diff?: Json | null
          id?: string
          llm_call_id?: number | null
          message?: string | null
          ops: Json
          outcome: string
          reply?: string | null
          seq: number
          session_id: string
          source: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          diff?: Json | null
          id?: string
          llm_call_id?: number | null
          message?: string | null
          ops?: Json
          outcome?: string
          reply?: string | null
          seq?: number
          session_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_edits_session_id_candidate_id_fkey"
            columns: ["session_id", "candidate_id"]
            isOneToOne: false
            referencedRelation: "plan_candidates"
            referencedColumns: ["session_id", "id"]
          },
          {
            foreignKeyName: "plan_edits_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "plan_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_sessions: {
        Row: {
          age_confirmed_at: string | null
          answers: Json
          created_at: string
          credits_reservation_id: string | null
          id: string
          input_hash: string
          qr_code_id: string | null
          shopper_id: string
          solver: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          age_confirmed_at?: string | null
          answers: Json
          created_at?: string
          credits_reservation_id?: string | null
          id?: string
          input_hash: string
          qr_code_id?: string | null
          shopper_id: string
          solver: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          age_confirmed_at?: string | null
          answers?: Json
          created_at?: string
          credits_reservation_id?: string | null
          id?: string
          input_hash?: string
          qr_code_id?: string | null
          shopper_id?: string
          solver?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_sessions_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_sessions_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "show_store_status"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "plan_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      poster_renders: {
        Row: {
          created_at: string
          effect_version_id: string | null
          framing: string
          height: number
          id: string
          path: string
          product_version_id: string | null
          renderer: string
          status: string
          t_ms: number
          updated_at: string
          width: number
        }
        Insert: {
          created_at?: string
          effect_version_id?: string | null
          framing: string
          height: number
          id?: string
          path: string
          product_version_id?: string | null
          renderer: string
          status?: string
          t_ms: number
          updated_at?: string
          width: number
        }
        Update: {
          created_at?: string
          effect_version_id?: string | null
          framing?: string
          height?: number
          id?: string
          path?: string
          product_version_id?: string | null
          renderer?: string
          status?: string
          t_ms?: number
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "poster_product_version_fk"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poster_renders_effect_version_id_fkey"
            columns: ["effect_version_id"]
            isOneToOne: false
            referencedRelation: "effect_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          created_at: string
          id: string
          kind: string
          result_media_id: string | null
          shopper_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          result_media_id?: string | null
          shopper_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          result_media_id?: string | null
          shopper_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_result_media_id_fkey"
            columns: ["result_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_requests_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_markets: {
        Row: {
          allowed: boolean
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          legal_category: string
          market: string
          min_age: number | null
          product_id: string
          supplied_by: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          legal_category: string
          market: string
          min_age?: number | null
          product_id: string
          supplied_by?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          legal_category?: string
          market?: string
          min_age?: number | null
          product_id?: string
          supplied_by?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_markets_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_markets_market_fkey"
            columns: ["market"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "product_markets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_markets_supplied_by_fkey"
            columns: ["supplied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_markets_supplier_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          created_at: string
          media_id: string
          product_id: string
          role: string
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          media_id: string
          product_id: string
          role: string
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          media_id?: string
          product_id?: string
          role?: string
          sort?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_version_effects: {
        Row: {
          created_at: string
          effect_id: string
          letter: string
          product_version_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effect_id: string
          letter: string
          product_version_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effect_id?: string
          letter?: string
          product_version_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_version_effects_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "effects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_version_effects_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_versions: {
        Row: {
          author_id: string | null
          candidate_id: string | null
          change_note: string | null
          composition: Json
          composition_schema: number
          created_at: string
          id: string
          number: number
          product_id: string
          published_at: string | null
          published_by: string | null
          source: string
          status: string
          summary: Json
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          candidate_id?: string | null
          change_note?: string | null
          composition: Json
          composition_schema?: number
          created_at?: string
          id?: string
          number: number
          product_id: string
          published_at?: string | null
          published_by?: string | null
          source?: string
          status?: string
          summary?: Json
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          candidate_id?: string | null
          change_note?: string | null
          composition?: Json
          composition_schema?: number
          created_at?: string
          id?: string
          number?: number
          product_id?: string
          published_at?: string | null
          published_by?: string | null
          source?: string
          status?: string
          summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_versions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_versions_candidate_fk"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "design_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          apex_m: number | null
          archived_at: string | null
          brand: string | null
          calibre_mm: number | null
          colours: string[]
          created_at: string
          created_by: string | null
          current_version_id: string | null
          description: string | null
          draft_version_id: string | null
          duration_ms: number | null
          energy: number | null
          gtin: string | null
          has_bangs: boolean
          has_crackle: boolean
          has_whistle: boolean
          id: string
          kind: string
          min_safety_distance_m: number | null
          name: string
          nec_grams: number | null
          noise_level: number | null
          safety_confirmed_at: string | null
          safety_confirmed_by: string | null
          safety_supplied_by: string | null
          safety_supplier_id: string | null
          shot_count: number | null
          slug: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          apex_m?: number | null
          archived_at?: string | null
          brand?: string | null
          calibre_mm?: number | null
          colours?: string[]
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          draft_version_id?: string | null
          duration_ms?: number | null
          energy?: number | null
          gtin?: string | null
          has_bangs?: boolean
          has_crackle?: boolean
          has_whistle?: boolean
          id?: string
          kind: string
          min_safety_distance_m?: number | null
          name: string
          nec_grams?: number | null
          noise_level?: number | null
          safety_confirmed_at?: string | null
          safety_confirmed_by?: string | null
          safety_supplied_by?: string | null
          safety_supplier_id?: string | null
          shot_count?: number | null
          slug: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          apex_m?: number | null
          archived_at?: string | null
          brand?: string | null
          calibre_mm?: number | null
          colours?: string[]
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          draft_version_id?: string | null
          duration_ms?: number | null
          energy?: number | null
          gtin?: string | null
          has_bangs?: boolean
          has_crackle?: boolean
          has_whistle?: boolean
          id?: string
          kind?: string
          min_safety_distance_m?: number | null
          name?: string
          nec_grams?: number | null
          noise_level?: number | null
          safety_confirmed_at?: string | null
          safety_confirmed_by?: string | null
          safety_supplied_by?: string | null
          safety_supplier_id?: string | null
          shot_count?: number | null
          slug?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_current_version_fk"
            columns: ["id", "current_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["product_id", "id"]
          },
          {
            foreignKeyName: "products_draft_version_fk"
            columns: ["id", "draft_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["product_id", "id"]
          },
          {
            foreignKeyName: "products_safety_confirmed_by_fkey"
            columns: ["safety_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_safety_supplied_by_fkey"
            columns: ["safety_supplied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_safety_supplier_fk"
            columns: ["safety_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_anonymous: boolean
          last_seen_at: string | null
          locale: string | null
          market: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          is_anonymous?: boolean
          last_seen_at?: string | null
          locale?: string | null
          market?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_anonymous?: boolean
          last_seen_at?: string | null
          locale?: string | null
          market?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_market_fkey"
            columns: ["market"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
        ]
      }
      qr_codes: {
        Row: {
          archived_at: string | null
          campaign_id: string | null
          created_at: string
          created_by: string | null
          id: string
          label_text: string | null
          organisation_id: string
          placement: string | null
          slug: string
          status: string
          store_id: string | null
          target_id: string | null
          target_type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label_text?: string | null
          organisation_id: string
          placement?: string | null
          slug: string
          status?: string
          store_id?: string | null
          target_id?: string | null
          target_type: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label_text?: string | null
          organisation_id?: string
          placement?: string | null
          slug?: string
          status?: string
          store_id?: string | null
          target_id?: string | null
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_organisation_id_campaign_id_fkey"
            columns: ["organisation_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "qr_codes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_codes_organisation_id_store_id_fkey"
            columns: ["organisation_id", "store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      range_items: {
        Row: {
          added_via: string | null
          created_at: string
          currency: string
          hidden: boolean
          id: string
          organisation_id: string
          price_minor: number
          product_id: string
          updated_at: string
        }
        Insert: {
          added_via?: string | null
          created_at?: string
          currency: string
          hidden?: boolean
          id?: string
          organisation_id: string
          price_minor: number
          product_id: string
          updated_at?: string
        }
        Update: {
          added_via?: string | null
          created_at?: string
          currency?: string
          hidden?: boolean
          id?: string
          organisation_id?: string
          price_minor?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "range_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "range_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          decision: string
          effect_version_id: string | null
          id: string
          note: string | null
          product_version_id: string | null
          reasons: string[]
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision: string
          effect_version_id?: string | null
          id?: string
          note?: string | null
          product_version_id?: string | null
          reasons?: string[]
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string
          effect_version_id?: string | null
          id?: string
          note?: string | null
          product_version_id?: string | null
          reasons?: string[]
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_effect_version_id_fkey"
            columns: ["effect_version_id"]
            isOneToOne: false
            referencedRelation: "effect_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_version_id_fkey"
            columns: ["product_version_id"]
            isOneToOne: false
            referencedRelation: "product_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_bands: {
        Row: {
          allowed_categories: string[]
          band: string
          created_at: string
          market: string
          max_distance_m: number
          updated_at: string
        }
        Insert: {
          allowed_categories: string[]
          band: string
          created_at?: string
          market: string
          max_distance_m: number
          updated_at?: string
        }
        Update: {
          allowed_categories?: string[]
          band?: string
          created_at?: string
          market?: string
          max_distance_m?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_bands_market_fkey"
            columns: ["market"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
        ]
      }
      sale_periods: {
        Row: {
          created_at: string
          id: string
          market: string
          name: string
          region: string | null
          requires_licence_outside: boolean
          rule: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          market: string
          name: string
          region?: string | null
          requires_licence_outside?: boolean
          rule: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          market?: string
          name?: string
          region?: string | null
          requires_licence_outside?: boolean
          rule?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_periods_market_fkey"
            columns: ["market"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
        ]
      }
      show_version_products: {
        Row: {
          organisation_id: string | null
          owner_id: string | null
          product_id: string
          quantity: number
          show_version_id: string
        }
        Insert: {
          organisation_id?: string | null
          owner_id?: string | null
          product_id: string
          quantity: number
          show_version_id: string
        }
        Update: {
          organisation_id?: string | null
          owner_id?: string | null
          product_id?: string
          quantity?: number
          show_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_version_products_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_version_products_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_version_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_version_products_show_version_id_fkey"
            columns: ["show_version_id"]
            isOneToOne: false
            referencedRelation: "show_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      show_versions: {
        Row: {
          change_note: string | null
          created_at: string
          created_by: string | null
          cues: Json
          duration_ms: number
          id: string
          number: number
          organisation_id: string | null
          owner_id: string | null
          plan_session_id: string | null
          show_id: string
          soundtrack_analysis_id: string | null
          soundtrack_offset_ms: number
        }
        Insert: {
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          cues: Json
          duration_ms: number
          id?: string
          number: number
          organisation_id?: string | null
          owner_id?: string | null
          plan_session_id?: string | null
          show_id: string
          soundtrack_analysis_id?: string | null
          soundtrack_offset_ms?: number
        }
        Update: {
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          cues?: Json
          duration_ms?: number
          id?: string
          number?: number
          organisation_id?: string | null
          owner_id?: string | null
          plan_session_id?: string | null
          show_id?: string
          soundtrack_analysis_id?: string | null
          soundtrack_offset_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "show_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_versions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_versions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_versions_plan_session_fk"
            columns: ["plan_session_id"]
            isOneToOne: false
            referencedRelation: "plan_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_versions_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "show_store_status"
            referencedColumns: ["show_id"]
          },
          {
            foreignKeyName: "show_versions_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_versions_soundtrack_analysis_fk"
            columns: ["soundtrack_analysis_id"]
            isOneToOne: false
            referencedRelation: "music_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          archived_at: string | null
          created_at: string
          current_version_id: string | null
          id: string
          name: string
          organisation_id: string | null
          origin: string
          owner_id: string | null
          share_token: string | null
          soundtrack_track_id: string | null
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          current_version_id?: string | null
          id?: string
          name: string
          organisation_id?: string | null
          origin: string
          owner_id?: string | null
          share_token?: string | null
          soundtrack_track_id?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          current_version_id?: string | null
          id?: string
          name?: string
          organisation_id?: string | null
          origin?: string
          owner_id?: string | null
          share_token?: string | null
          soundtrack_track_id?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shows_current_version_fk"
            columns: ["id", "current_version_id"]
            isOneToOne: false
            referencedRelation: "show_versions"
            referencedColumns: ["show_id", "id"]
          },
          {
            foreignKeyName: "shows_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_soundtrack_track_fk"
            columns: ["soundtrack_track_id"]
            isOneToOne: false
            referencedRelation: "music_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          created_at: string
          profile_id: string
          requires_mfa: boolean
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          requires_mfa?: boolean
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          requires_mfa?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          at: string
          delta: number
          id: number
          organisation_id: string
          qty_after: number
          range_item_id: string
          ref: string | null
          source: string
          store_id: string
        }
        Insert: {
          at?: string
          delta: number
          id?: never
          organisation_id: string
          qty_after: number
          range_item_id: string
          ref?: string | null
          source: string
          store_id: string
        }
        Update: {
          at?: string
          delta?: number
          id?: never
          organisation_id?: string
          qty_after?: number
          range_item_id?: string
          ref?: string | null
          source?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organisation_id_store_id_range_item_id_fkey"
            columns: ["organisation_id", "store_id", "range_item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
            referencedColumns: ["organisation_id", "store_id", "range_item_id"]
          },
          {
            foreignKeyName: "stock_movements_organisation_id_store_id_range_item_id_fkey"
            columns: ["organisation_id", "store_id", "range_item_id"]
            isOneToOne: false
            referencedRelation: "store_prices"
            referencedColumns: ["organisation_id", "store_id", "range_item_id"]
          },
        ]
      }
      store_items: {
        Row: {
          aisle: string | null
          bay: string | null
          created_at: string
          hidden: boolean
          low_stock_at: number
          organisation_id: string
          price_override_minor: number | null
          range_item_id: string
          store_id: string
          till_sku: string | null
          updated_at: string
        }
        Insert: {
          aisle?: string | null
          bay?: string | null
          created_at?: string
          hidden?: boolean
          low_stock_at?: number
          organisation_id: string
          price_override_minor?: number | null
          range_item_id: string
          store_id: string
          till_sku?: string | null
          updated_at?: string
        }
        Update: {
          aisle?: string | null
          bay?: string | null
          created_at?: string
          hidden?: boolean
          low_stock_at?: number
          organisation_id?: string
          price_override_minor?: number | null
          range_item_id?: string
          store_id?: string
          till_sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_items_organisation_id_range_item_id_fkey"
            columns: ["organisation_id", "range_item_id"]
            isOneToOne: false
            referencedRelation: "range_items"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "store_items_organisation_id_store_id_fkey"
            columns: ["organisation_id", "store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
      stores: {
        Row: {
          address: Json | null
          created_at: string
          id: string
          licence: string
          location: unknown
          market: string
          name: string
          opening_hours: Json | null
          organisation_id: string
          postcode: string | null
          region: string | null
          shopper_settings: Json
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          created_at?: string
          id?: string
          licence: string
          location?: unknown
          market: string
          name: string
          opening_hours?: Json | null
          organisation_id: string
          postcode?: string | null
          region?: string | null
          shopper_settings?: Json
          slug: string
          status?: string
          timezone: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          created_at?: string
          id?: string
          licence?: string
          location?: unknown
          market?: string
          name?: string
          opening_hours?: Json | null
          organisation_id?: string
          postcode?: string | null
          region?: string | null
          shopper_settings?: Json
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_market_fkey"
            columns: ["market"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "stores_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_members: {
        Row: {
          created_at: string
          profile_id: string
          role: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          role: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          role?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_members_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          available: boolean
          case_qty: number | null
          cost_minor: number | null
          created_at: string
          currency: string | null
          gtin: string | null
          id: string
          last_import_id: string | null
          name_raw: string
          product_id: string | null
          rrp_minor: number | null
          safety_facts: Json
          supplied_by: string | null
          supplier_code: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          case_qty?: number | null
          cost_minor?: number | null
          created_at?: string
          currency?: string | null
          gtin?: string | null
          id?: string
          last_import_id?: string | null
          name_raw: string
          product_id?: string | null
          rrp_minor?: number | null
          safety_facts?: Json
          supplied_by?: string | null
          supplier_code: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          case_qty?: number | null
          cost_minor?: number | null
          created_at?: string
          currency?: string | null
          gtin?: string | null
          id?: string
          last_import_id?: string | null
          name_raw?: string
          product_id?: string | null
          rrp_minor?: number | null
          safety_facts?: Json
          supplied_by?: string | null
          supplier_code?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_import_supplier_fk"
            columns: ["supplier_id", "last_import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["supplier_id", "id"]
          },
          {
            foreignKeyName: "supplier_products_last_import_fk"
            columns: ["last_import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplied_by_fkey"
            columns: ["supplied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_email: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          price_list_format: Json | null
          slug: string
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          contact_email?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          price_list_format?: Json | null
          slug: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          contact_email?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          price_list_format?: Json | null
          slug?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_country_fkey"
            columns: ["country"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["code"]
          },
        ]
      }
      video_analyses: {
        Row: {
          created_at: string
          error: string | null
          extractor: string
          features: Json | null
          id: string
          keyframes: Json | null
          media_id: string
          priors: Json
          product_id: string | null
          shots: Json | null
          status: string
          supplier_product_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          extractor: string
          features?: Json | null
          id?: string
          keyframes?: Json | null
          media_id: string
          priors?: Json
          product_id?: string | null
          shots?: Json | null
          status?: string
          supplier_product_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          extractor?: string
          features?: Json | null
          id?: string
          keyframes?: Json | null
          media_id?: string
          priors?: Json
          product_id?: string | null
          shots?: Json | null
          status?: string
          supplier_product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_analyses_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_analyses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_analyses_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      show_store_status: {
        Row: {
          available: boolean | null
          currency: string | null
          organisation_id: string | null
          price_minor: number | null
          show_id: string | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      store_prices: {
        Row: {
          currency: string | null
          hidden: boolean | null
          organisation_id: string | null
          price_minor: number | null
          product_id: string | null
          range_item_id: string | null
          stock_qty: number | null
          stock_source: string | null
          stock_updated_at: string | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "range_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_items_organisation_id_range_item_id_fkey"
            columns: ["organisation_id", "range_item_id"]
            isOneToOne: false
            referencedRelation: "range_items"
            referencedColumns: ["organisation_id", "id"]
          },
          {
            foreignKeyName: "store_items_organisation_id_store_id_fkey"
            columns: ["organisation_id", "store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["organisation_id", "id"]
          },
        ]
      }
    }
    Functions: {
      accept_design_candidate: {
        Args: {
          p_candidate_id: string
          p_kind?: string
          p_name?: string
          p_slug?: string
        }
        Returns: string
      }
      archive_effect: { Args: { p_effect_id: string }; Returns: undefined }
      archive_product: { Args: { p_product_id: string }; Returns: undefined }
      confirm_product_safety: {
        Args: {
          p_calibre_mm?: number
          p_distance_m: number
          p_markets: Json
          p_nec_grams?: number
          p_noise_level: number
          p_product_id: string
          p_supplied_by?: string
          p_supplier_id?: string
        }
        Returns: undefined
      }
      create_effect_draft: {
        Args: {
          p_design: Json
          p_effect_id: string
          p_family: string
          p_name: string
          p_parent_version_id?: string
          p_renderer: string
          p_slug: string
        }
        Returns: string
      }
      create_list: {
        Args: {
          p_candidate?: string
          p_items: Json
          p_store: string
          p_till_code: string
          p_valid_until: string
        }
        Returns: string
      }
      create_pack: { Args: { p_name: string; p_slug: string }; Returns: string }
      create_product_draft: {
        Args: {
          p_bindings: Json
          p_composition: Json
          p_kind: string
          p_name: string
          p_product_id: string
          p_slug: string
          p_source?: string
        }
        Returns: string
      }
      publish_effect_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      publish_pack: { Args: { p_pack_id: string }; Returns: undefined }
      publish_product_version: {
        Args: { p_version_id: string }
        Returns: undefined
      }
      record_stock: {
        Args: {
          p_delta: number
          p_range_item: string
          p_ref?: string
          p_source: string
          p_store: string
        }
        Returns: number
      }
      resolve_qr: { Args: { p_slug: string }; Returns: Json }
      save_effect_details: {
        Args: {
          p_effect_id: string
          p_family: string
          p_is_template: boolean
          p_name: string
        }
        Returns: undefined
      }
      save_effect_draft: {
        Args: {
          p_change_note?: string
          p_checks?: Json
          p_design: Json
          p_reference_media_id?: string
          p_renderer: string
          p_version_id: string
        }
        Returns: undefined
      }
      save_music_analysis: {
        Args: {
          p_algorithm: string
          p_analysis: Json
          p_audio_sha256: string
          p_track: string
        }
        Returns: string
      }
      save_pack_items: {
        Args: { p_items: Json; p_pack_id: string }
        Returns: undefined
      }
      save_product_details: {
        Args: {
          p_brand: string
          p_description: string
          p_gtin: string
          p_product_id: string
        }
        Returns: undefined
      }
      save_product_draft: {
        Args: {
          p_bindings: Json
          p_change_note?: string
          p_composition: Json
          p_version_id: string
        }
        Returns: undefined
      }
      save_show: {
        Args: {
          p_change_note?: string
          p_cues: Json
          p_duration_ms: number
          p_plan_session?: string
          p_show: string
          p_soundtrack_analysis?: string
          p_soundtrack_offset_ms?: number
        }
        Returns: string
      }
      shop_customers: { Args: { p_organisation: string }; Returns: Json }
      show_for_store: {
        Args: { p_show: string; p_store: string }
        Returns: Json
      }
      start_plan_session: {
        Args: {
          p_age_confirmed_at?: string
          p_answers: Json
          p_input_hash: string
          p_qr_code?: string
          p_solver: string
          p_store: string
        }
        Returns: string
      }
      store_page: { Args: { p_store: string }; Returns: Json }
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
