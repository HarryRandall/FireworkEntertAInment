import type { Database, Json } from '@/lib/database.types';
/** Additive RPC contract until types can be regenerated against an isolated migrated database. */
export type EditorDatabase = Database & {
  public: {
    Functions: {
      create_firework_from_template: {
        Args: {
          p_template_key: string;
          p_name: string;
          p_design: Json;
          p_model: Json;
          p_render_snapshot: Json;
          p_duration_seconds: number;
        };
        Returns: string;
      };
    };
  };
};
