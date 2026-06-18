import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import {
  FIREWORK_STYLE_DEFAULT_KINDS,
  NO_STYLE_DEFAULT_VALUE,
  type FireworkStyleDefaultKind,
  type StyleDefaultIdMap,
} from '@/lib/fireworks/style-defaults';
import { isMissingStyleDefaultSchemaError } from './style-default-schema';

type Supabase = SupabaseClient<Database>;
type AssignmentMap = Record<FireworkStyleDefaultKind, string | null>;

type ValidationResult = { ok: true } | { ok: false; error: string };

export function normaliseStyleDefaultAssignments(input: {
  styleDefaultIds?: StyleDefaultIdMap | null;
  starStyleDefaultId?: string | null;
  trailStyleDefaultId?: string | null;
}): AssignmentMap {
  const assignments = Object.fromEntries(
    FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => [kind, null]),
  ) as AssignmentMap;

  assignments.star = input.starStyleDefaultId ?? null;
  assignments.trail = input.trailStyleDefaultId ?? null;

  for (const kind of FIREWORK_STYLE_DEFAULT_KINDS) {
    const value = input.styleDefaultIds?.[kind];
    if (value === undefined) continue;
    assignments[kind] = value && value !== NO_STYLE_DEFAULT_VALUE ? value : null;
  }

  return assignments;
}

export async function validateStyleDefaultAssignments(
  supabase: Supabase,
  assignments: AssignmentMap,
): Promise<ValidationResult> {
  const selected = FIREWORK_STYLE_DEFAULT_KINDS.flatMap((kind) => {
    const id = assignments[kind];
    return id ? [{ kind, id }] : [];
  });
  if (selected.length === 0) return { ok: true };

  const { data, error } = await supabase
    .from('firework_style_defaults')
    .select('id, kind')
    .in(
      'id',
      selected.map((item) => item.id),
    );

  if (error) return { ok: false, error: error.message };

  const kindById = new Map((data ?? []).map((row) => [row.id, row.kind]));
  for (const item of selected) {
    const actualKind = kindById.get(item.id);
    if (!actualKind) return { ok: false, error: 'One selected style default no longer exists.' };
    if (actualKind !== item.kind) {
      return {
        ok: false,
        error: 'One selected style default does not match the requested section.',
      };
    }
  }

  return { ok: true };
}

async function replaceStyleDefaultLinks(
  supabase: Supabase,
  table: 'firework_effect_style_default_links' | 'firework_style_default_links',
  ownerColumn: 'firework_effect_id' | 'firework_id',
  ownerId: string,
  assignments: AssignmentMap,
): Promise<ValidationResult> {
  const deleteResult =
    table === 'firework_effect_style_default_links'
      ? await supabase.from(table).delete().eq('firework_effect_id', ownerId)
      : await supabase.from(table).delete().eq('firework_id', ownerId);
  if (deleteResult.error) {
    if (isMissingStyleDefaultSchemaError(deleteResult.error)) return { ok: true };
    return { ok: false, error: deleteResult.error.message };
  }

  const rows = FIREWORK_STYLE_DEFAULT_KINDS.flatMap((kind) => {
    const styleDefaultId = assignments[kind];
    return styleDefaultId
      ? [
          {
            [ownerColumn]: ownerId,
            kind,
            style_default_id: styleDefaultId,
          },
        ]
      : [];
  });
  if (rows.length === 0) return { ok: true };

  const insertResult =
    table === 'firework_effect_style_default_links'
      ? await supabase.from(table).insert(
          rows.map((row) => ({
            firework_effect_id: row[ownerColumn],
            kind: row.kind,
            style_default_id: row.style_default_id,
          })),
        )
      : await supabase.from(table).insert(
          rows.map((row) => ({
            firework_id: row[ownerColumn],
            kind: row.kind,
            style_default_id: row.style_default_id,
          })),
        );
  if (insertResult.error) {
    if (isMissingStyleDefaultSchemaError(insertResult.error)) return { ok: true };
    return { ok: false, error: insertResult.error.message };
  }

  return { ok: true };
}

export function replaceEffectStyleDefaultLinks(
  supabase: Supabase,
  effectId: string,
  assignments: AssignmentMap,
): Promise<ValidationResult> {
  return replaceStyleDefaultLinks(
    supabase,
    'firework_effect_style_default_links',
    'firework_effect_id',
    effectId,
    assignments,
  );
}

export function replaceFireworkStyleDefaultLinks(
  supabase: Supabase,
  fireworkId: string,
  assignments: AssignmentMap,
): Promise<ValidationResult> {
  return replaceStyleDefaultLinks(
    supabase,
    'firework_style_default_links',
    'firework_id',
    fireworkId,
    assignments,
  );
}
