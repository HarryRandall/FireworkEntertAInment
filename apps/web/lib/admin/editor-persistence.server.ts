import 'server-only';

import type { Json } from '@/lib/database.types';
import type { createClient } from '@/lib/supabase/server';
import { FIREWORK_STYLE_DEFAULT_KINDS } from '@showcrafter/fireworks/style-defaults';
import { z } from 'zod';

const CommonRow = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  updated_at: z.string(),
});
const EffectRow = CommonRow.extend({
  pattern_key: z.string(),
  sort_order: z.number(),
  model_json: z.json(),
});
const FireworkRow = CommonRow.extend({
  firework_effect_id: z.string(),
  caliber: z.string().nullable(),
  duration_seconds: z.number().nullable(),
  height_meters: z.number().nullable(),
  primary_color: z.string().nullable(),
  secondary_color: z.string().nullable(),
  color_palette: z.array(z.string()),
  render_overrides_json: z.json(),
});
const StyleRow = CommonRow.extend({
  kind: z.enum(FIREWORK_STYLE_DEFAULT_KINDS),
  defaults_json: z.json(),
  sort_order: z.number(),
  is_archived: z.boolean(),
});
const HistoryRow = z
  .object({
    id: z.string(),
    target_kind: z.enum(['effect', 'firework', 'style_default']),
    firework_id: z.string().nullable(),
    firework_effect_id: z.string().nullable(),
    firework_style_default_id: z.string().nullable(),
    action: z.enum(['update', 'restore']),
    summary: z.string(),
    snapshot_json: z.json(),
    previous_snapshot_json: z.json(),
    changes_json: z.json(),
    created_by: z.string().nullable(),
    created_by_label: z.string(),
    created_at: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    targetKind: row.target_kind,
    fireworkId: row.firework_id,
    fireworkEffectId: row.firework_effect_id,
    fireworkStyleDefaultId: row.firework_style_default_id,
    action: row.action,
    summary: row.summary,
    snapshotJson: row.snapshot_json,
    previousSnapshotJson: row.previous_snapshot_json,
    changesJson: row.changes_json,
    createdBy: row.created_by,
    createdByLabel: row.created_by_label,
    createdAt: row.created_at,
  }));
const ResultFields = {
  ok: z.literal(true),
  historyVersion: HistoryRow,
  styleDefault: StyleRow.nullable(),
};
const SavedResponse = z.discriminatedUnion('kind', [
  z.object({ ...ResultFields, kind: z.literal('effect'), saved: EffectRow }),
  z.object({ ...ResultFields, kind: z.literal('firework'), saved: FireworkRow }),
  z.object({ ...ResultFields, kind: z.literal('style_default'), saved: StyleRow }),
]);
type Kind = z.infer<typeof SavedResponse>['kind'];
type SaveResult<K extends Kind> =
  | Extract<z.infer<typeof SavedResponse>, { kind: K }>
  | { ok: false; error: string };

export async function saveEditorRecord<K extends Kind>(
  supabase: ReturnType<typeof createClient>,
  input: {
    kind: K;
    id: string;
    expectedUpdatedAt: string;
    patch: Json;
    historyVersionId?: string;
    restoreVersionId?: string;
    inlineStyle?: {
      slug: string;
      name: string;
      description: string | null;
      kind: string;
      defaults_json: Json;
    };
  },
): Promise<SaveResult<K>> {
  const historyId = input.historyVersionId ?? crypto.randomUUID();
  const { data, error } = await supabase.rpc('save_firework_editor', {
    p_kind: input.kind,
    p_id: input.id,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_patch: input.patch,
    p_history_id: historyId,
    p_action: input.restoreVersionId ? 'restore' : 'update',
    ...(input.restoreVersionId ? { p_restore_version_id: input.restoreVersionId } : {}),
    ...(input.inlineStyle ? { p_inline_style: input.inlineStyle } : {}),
  });
  if (error) return { ok: false, error: error.message };
  if (z.object({ ok: z.literal(false), code: z.literal('conflict') }).safeParse(data).success) {
    return {
      ok: false,
      error: 'This record changed in another session. Refresh before saving again.',
    };
  }
  const parsed = SavedResponse.safeParse(data);
  if (
    !parsed.success ||
    parsed.data.kind !== input.kind ||
    parsed.data.saved.id !== input.id ||
    parsed.data.historyVersion.id !== historyId ||
    parsed.data.historyVersion.targetKind !== input.kind ||
    (parsed.data.historyVersion.fireworkId ??
      parsed.data.historyVersion.fireworkEffectId ??
      parsed.data.historyVersion.fireworkStyleDefaultId) !== input.id
  ) {
    return {
      ok: false,
      error: 'Could not confirm the saved record and its version history. Refresh before retrying.',
    };
  }
  // The runtime discriminant has been checked against the requested generic kind.
  return parsed.data as Extract<z.infer<typeof SavedResponse>, { kind: K }>;
}
