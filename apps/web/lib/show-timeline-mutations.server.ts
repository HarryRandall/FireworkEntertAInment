import 'server-only';

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

type TimelineMutationResult = {
  data: string | null;
  error: PostgrestError | null;
};

type AddShowTimelineItemArgs = {
  p_catalogue_item_id: string;
  p_emphasis: 'normal' | 'accent' | 'peak';
  p_launch_position_index: number;
  p_show_id: string;
  p_time_seconds: number;
};

export async function addShowTimelineItem(
  client: SupabaseClient<Database>,
  args: AddShowTimelineItemArgs,
): Promise<TimelineMutationResult> {
  return client.rpc('add_show_timeline_item', args);
}

export async function deleteShowTimelineItem(
  client: SupabaseClient<Database>,
  cueId: string,
): Promise<TimelineMutationResult> {
  return client.rpc('delete_show_timeline_item', {
    p_cue_id: cueId,
  });
}
