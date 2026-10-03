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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
