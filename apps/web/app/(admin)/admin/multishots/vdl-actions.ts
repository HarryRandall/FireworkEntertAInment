'use server';

/** Create a multishot, and any fireworks it is missing, from one pasted Finale VDL cake line. */
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { effectTemplates, shotDuration } from '@showcrafter/renderer';
import { canonicaliseEffectModelJson, compileFireworkDesign } from '@showcrafter/fireworks/design';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/access/current-profile.server';
import {
  invalidateAdminCatalogueCache,
  invalidateAdminEffectsCache,
  invalidateAdminFireworksCache,
  invalidateAdminMultishotsCache,
} from '@/lib/admin/cache-keys';
import { invalidateFireworkCatalogueCaches } from '@/lib/shows/cache-keys';
import { MULTISHOT_NAME_MAX_LENGTH } from '@/lib/admin/multishot-constraints';
import { previewVdlLine } from '@/lib/finale/vdl/catalogue.server';
import { summariseVdlPreview, type VdlPreviewSummary } from '@/lib/finale/vdl/preview';
import type { Json } from '@/lib/database.types';

const MAX_LINE_CHARACTERS = 200_000; // VDL line budget, characters.
const MILLISECONDS_PER_SECOND = 1000; // SI milliseconds per second.

const LineInput = z.string().max(MAX_LINE_CHARACTERS);
const CreateInput = z.object({
  text: LineInput,
  name: z.string().trim().min(1).max(MULTISHOT_NAME_MAX_LENGTH),
});

export type VdlPreviewActionResult =
  | { ok: true; preview: VdlPreviewSummary; invalidWords: string[] }
  | { ok: false; error: string };

/** Reads the line against the current word list and catalogue without writing anything. */
export async function previewVdlMultishot(text: string): Promise<VdlPreviewActionResult> {
  if (!(await requirePermission('admin.manage_catalogue')))
    return { ok: false, error: 'Not permitted.' };
  const parsed = LineInput.safeParse(text);
  if (!parsed.success) return { ok: false, error: 'The VDL line is too long.' };
  const built = await previewVdlLine(parsed.data);
  if (!built.ok) return built;
  if (built.result.kind === 'error') return { ok: false, error: built.result.message };
  return {
    ok: true,
    preview: summariseVdlPreview(built.result.preview),
    invalidWords: built.invalidWords,
  };
}

function json(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

/** Rebuilds the preview on the server, then creates fireworks, multishot and shots in one transaction. */
export async function createVdlMultishot(
  input: z.infer<typeof CreateInput>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!(await requirePermission('admin.manage_catalogue')))
    return { ok: false, error: 'Not permitted.' };
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Enter a name and one VDL line.' };
  const built = await previewVdlLine(parsed.data.text);
  if (!built.ok) return built;
  if (built.result.kind === 'error') return { ok: false, error: built.result.message };
  const { preview } = built.result;
  const failed = preview.parts.find((part) => part.error !== null);
  if (failed)
    return { ok: false, error: `Part (${failed.letter}) could not be read: ${failed.error}` };
  // The legacy engine has no exact conversion for these designs; it schedules a plain sphere.
  const model = canonicaliseEffectModelJson({
    geometry: 'sphere',
    trailProfile: 'none',
    renderDefaults: { geometry: 'sphere' },
  });
  const snapshot = json(compileFireworkDesign({ baseModel: model }));
  const fireworks = Object.values(preview.fireworks)
    .filter((firework) => firework.match === null)
    .map((firework) => {
      const base = effectTemplates.find((item) => item.key === firework.templateKey);
      return {
        key: firework.key,
        template_key: firework.templateKey,
        template_name: base?.name ?? firework.templateKey,
        template_design: json(base?.design ?? firework.design),
        name: firework.name,
        design: json(firework.design),
        model: json(model),
        render_snapshot: snapshot,
        duration_seconds: Number(shotDuration(firework.design).toFixed(2)),
        caliber: preview.caliberText,
        height_meters: firework.heightM,
      };
    });
  const shots = preview.shots.map((shot) => {
    const firework = preview.fireworks[shot.firework];
    return {
      sequence_index: shot.sequence,
      time_offset_seconds: shot.timeMs / MILLISECONDS_PER_SECOND,
      pan_degrees: shot.angleDeg,
      timeline_track_index: shot.track,
      ...(firework.match ? { firework_id: firework.match.id } : { firework_key: firework.key }),
    };
  });
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc('create_vdl_multishot', {
    p_name: parsed.data.name,
    p_description: parsed.data.text.trim().slice(0, 5000),
    p_fireworks: json(fireworks),
    p_shots: json(shots),
  });
  if (error) return { ok: false, error: 'The multishot could not be created.' };
  const result = z
    .union([
      z.object({ ok: z.literal(true), id: z.string().uuid() }),
      z.object({ ok: z.literal(false), error: z.string() }),
    ])
    .safeParse(data);
  if (!result.success) return { ok: false, error: 'Could not confirm the created multishot.' };
  if (!result.data.ok) return result.data;
  await Promise.all([
    invalidateAdminMultishotsCache(result.data.id),
    invalidateAdminCatalogueCache(),
    invalidateAdminEffectsCache(),
    invalidateAdminFireworksCache(),
    invalidateFireworkCatalogueCaches(),
  ]);
  for (const path of [
    '/admin/multishots',
    '/admin/fireworks',
    '/admin/effects',
    '/admin/catalogue',
  ])
    revalidatePath(path);
  return { ok: true, id: result.data.id };
}
