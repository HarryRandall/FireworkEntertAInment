/** Additive RPC contract until database types can be regenerated from the applied migration. */
import type { Database, Json } from '../database.types';

export type CompositionDatabase = Database & {
  public: {
    Functions: {
      save_multishot_composition: {
        Args: { p_id: string; p_expected_updated_at: string; p_shots: Json };
        Returns: Json;
      };
    };
    Tables: {
      multishot_composition_versions: {
        Row: {
          id: string;
          multishot_id: string;
          actor_id: string | null;
          created_at: string;
          before_shots: Json;
          after_shots: Json;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
  };
};
