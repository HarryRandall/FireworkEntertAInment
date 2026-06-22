import 'server-only';

import type { AdminEditorVersion } from '@/lib/admin.types';
import type { Database } from '@/lib/database.types';
import { describeSupabaseError, isMissingEditorVersionSchemaError } from './style-default-schema';
import { getServerClient } from './supabase';

type ServerClient = Awaited<ReturnType<typeof getServerClient>>;
type EditorVersionRow = Database['public']['Tables']['firework_editor_versions']['Row'];

const EDITOR_VERSION_SELECT =
  'id, target_kind, firework_id, firework_effect_id, action, summary, snapshot_json, previous_snapshot_json, changes_json, created_by, created_by_label, created_at';

function mapEditorVersion(row: EditorVersionRow): AdminEditorVersion {
  return {
    id: row.id,
    targetKind: row.target_kind === 'effect' ? 'effect' : 'firework',
    fireworkId: row.firework_id,
    fireworkEffectId: row.firework_effect_id,
    action: row.action === 'restore' ? 'restore' : 'update',
    summary: row.summary,
    snapshotJson: row.snapshot_json,
    previousSnapshotJson: row.previous_snapshot_json,
    changesJson: row.changes_json,
    createdBy: row.created_by,
    createdByLabel: row.created_by_label,
    createdAt: row.created_at,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSyntheticCurrentVersion(row: EditorVersionRow): boolean {
  return isRecord(row.changes_json) && row.changes_json.currentVersion === true;
}

export async function listFireworkEditorVersions(
  supabase: ServerClient,
  fireworkId: string,
  limit = 24,
): Promise<AdminEditorVersion[]> {
  const { data, error } = await supabase
    .from('firework_editor_versions')
    .select(EDITOR_VERSION_SELECT)
    .eq('firework_id', fireworkId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingEditorVersionSchemaError(error)) return [];
    console.error(
      '[admin.editor-versions] listFireworkEditorVersions failed:',
      describeSupabaseError(error),
    );
    return [];
  }

  return ((data ?? []) as EditorVersionRow[])
    .filter((row) => !isSyntheticCurrentVersion(row))
    .map(mapEditorVersion);
}

export async function listEffectEditorVersions(
  supabase: ServerClient,
  effectId: string,
  limit = 24,
): Promise<AdminEditorVersion[]> {
  const { data, error } = await supabase
    .from('firework_editor_versions')
    .select(EDITOR_VERSION_SELECT)
    .eq('firework_effect_id', effectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingEditorVersionSchemaError(error)) return [];
    console.error(
      '[admin.editor-versions] listEffectEditorVersions failed:',
      describeSupabaseError(error),
    );
    return [];
  }

  return ((data ?? []) as EditorVersionRow[])
    .filter((row) => !isSyntheticCurrentVersion(row))
    .map(mapEditorVersion);
}
