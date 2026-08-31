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

type TimelineMutationRpcClient = {
  rpc(
    functionName: 'add_show_timeline_item',
    args: AddShowTimelineItemArgs,
  ): Promise<TimelineMutationResult>;
  rpc(
    functionName: 'delete_show_timeline_item',
    args: { p_cue_id: string },
  ): Promise<TimelineMutationResult>;
};

function mutationRpcClient(client: SupabaseClient<Database>): TimelineMutationRpcClient {
  // TODO: Remove this adapter after the generated types can include the new
  // RPCs without colliding with the concurrent schema work in this checkout.
  return client as unknown as TimelineMutationRpcClient;
}

export async function addShowTimelineItem(
  client: SupabaseClient<Database>,
  args: AddShowTimelineItemArgs,
): Promise<TimelineMutationResult> {
  return mutationRpcClient(client).rpc('add_show_timeline_item', args);
}

export async function deleteShowTimelineItem(
  client: SupabaseClient<Database>,
  cueId: string,
): Promise<TimelineMutationResult> {
  return mutationRpcClient(client).rpc('delete_show_timeline_item', {
    p_cue_id: cueId,
  });
}
