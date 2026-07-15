'use server';

/** Admin actions for curated Explore/Home show presets. */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';
import { invalidateShowTemplatesCache, requirePermission } from '@/lib/admin.server';
import { randomCover } from '@/lib/cover';
import type { Json } from '@/lib/database.types';
import type { FireworkSpecification } from '@/lib/show-domain';
import { slugifyTitle } from '@/lib/show-domain';
import { validatePresetTimeline } from '@/lib/show-preset-timing.server';
import { listFireworkProducts } from '@/lib/shows.server';

type Result = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type BulkImportResult =
  | { ok: true; importedCount: number; skippedCount: number; firstId: string | null }
  | { ok: false; error: string };
type ServiceClient = NonNullable<ReturnType<typeof createServiceRoleSupabase>>;
type GeneratedShowRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  budget_cents: number | null;
  total_cents: number;
  effects_count: number;
  time_of_day: string | null;
  mood_tags: string[] | null;
  cover_shader: Json | null;
  cover_image_path: string | null;
  generation_status: string;
};
type GeneratedShowCueRow = {
  show_id: string;
  position: number;
  time_seconds: number | null;
  description: string;
  catalogue_item_id: string | null;
  launch_position_index: number | null;
  emphasis: string | null;
  catalogue_items:
    | { part_number: string; name: string }
    | { part_number: string; name: string }[]
    | null;
};

const CueEmphasisSchema = z.enum(['normal', 'accent', 'peak']);
const BULK_IMPORT_PAGE_SIZE = 500;
const INSERT_CHUNK_SIZE = 100;
const GENERATED_SHOW_SELECT =
  'id, slug, title, description, duration_seconds, budget_cents, total_cents, effects_count, time_of_day, mood_tags, cover_shader, cover_image_path, generation_status';
const GENERATED_SHOW_CUE_SELECT =
  'show_id, position, time_seconds, description, catalogue_item_id, launch_position_index, emphasis, catalogue_items(part_number, name)';

const ShowPresetCueSchema = z.object({
  catalogueItemId: z.string().uuid(),
  catalogueItemSlug: z.string().trim().min(1).max(120),
  timeSeconds: z.coerce
    .number()
    .min(0)
    .max(60 * 60),
  description: z.string().trim().min(1).max(180),
  launchPositionIndex: z.coerce.number().int().min(0).max(2).default(0),
  emphasis: CueEmphasisSchema.default('normal'),
});

const CreatePresetSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

const IdSchema = z.object({
  id: z.string().uuid(),
});

const ImportShowSchema = z.object({
  showId: z.string().uuid(),
});

const UpdateDetailsSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  theme: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1200).optional().nullable(),
  durationSeconds: z.coerce
    .number()
    .int()
    .min(1)
    .max(60 * 60),
  budgetCents: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  timeOfDay: z.string().trim().max(80).optional().nullable(),
  moodTags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(100_000).default(0),
});

const ReplaceCuesSchema = z.object({
  id: z.string().uuid(),
  cues: z.array(ShowPresetCueSchema).max(360),
});

const PublishSchema = z.object({
  id: z.string().uuid(),
  isPublished: z.boolean(),
});

function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input.';
}

function supabaseErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? 'Unknown Supabase error.');
  const record = error as { code?: string; message?: string; details?: string; hint?: string };
  return [record.code, record.message, record.details, record.hint].filter(Boolean).join(' ');
}

function uniqueSlug(title: string): string {
  return `${slugifyTitle(title)}-${Math.random().toString(36).slice(2, 6)}`;
}

function importedGeneratedShowSlug(show: Pick<GeneratedShowRow, 'id' | 'title'>): string {
  const fingerprint = createHash('md5').update(show.id).digest('hex').slice(0, 8);
  return `${slugifyTitle(show.title)}-${fingerprint}`;
}

function normaliseLaunchPositionIndex(value: unknown): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(2, Math.round(numeric)));
}

async function refreshPresetPaths(slug?: string | null) {
  await invalidateShowTemplatesCache();
  revalidatePath('/admin/show-presets');
  revalidatePath('/admin/show-presets/[id]', 'page');
  revalidatePath('/home');
  revalidatePath('/library');
  if (slug) revalidatePath(`/library/${slug}`);
}

async function deriveCueTotals(
  supabase: ReturnType<typeof createClient>,
  catalogueItemIds: string[],
): Promise<{ totalCents: number; effectsCount: number }> {
  if (catalogueItemIds.length === 0) return { totalCents: 0, effectsCount: 0 };

  const counts = new Map<string, number>();
  for (const id of catalogueItemIds) counts.set(id, (counts.get(id) ?? 0) + 1);

  const { data: inventoryRows, error } = await supabase
    .from('supplier_inventory_items')
    .select('catalogue_item_id, price_cents')
    .in('catalogue_item_id', Array.from(counts.keys()))
    .eq('available', true)
    .not('price_cents', 'is', null);
  if (error) throw new Error(`Could not calculate preset totals: ${error.message}`);

  const cheapestPrice = new Map<string, number>();
  for (const row of inventoryRows ?? []) {
    if (!row.catalogue_item_id || row.price_cents == null) continue;
    const current = cheapestPrice.get(row.catalogue_item_id);
    if (current == null || row.price_cents < current) {
      cheapestPrice.set(row.catalogue_item_id, row.price_cents);
    }
  }

  let totalCents = 0;
  for (const [id, qty] of counts) totalCents += (cheapestPrice.get(id) ?? 0) * qty;
  return { totalCents, effectsCount: catalogueItemIds.length };
}

async function loadCatalogueProducts(
  catalogueItemIds: string[],
): Promise<Map<string, FireworkSpecification> | null> {
  if (catalogueItemIds.length === 0) return new Map();
  try {
    const requestedIds = new Set(catalogueItemIds);
    const products = await listFireworkProducts({ lightweight: true });
    const map = new Map(
      products
        .filter((product) => requestedIds.has(product.id))
        .map((product) => [product.id, product]),
    );
    return map.size === requestedIds.size ? map : null;
  } catch {
    return null;
  }
}

async function validatePublishablePreset(
  supabase: ReturnType<typeof createClient>,
  presetId: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const { data: preset, error } = await supabase
    .from('show_presets')
    .select('slug, title, theme, duration_seconds, preview_cues')
    .eq('id', presetId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!preset) return { ok: false, error: 'Preset not found.' };
  if (!preset.title.trim() || !preset.theme.trim() || !preset.duration_seconds) {
    return { ok: false, error: 'Add a title, theme and duration before publishing.' };
  }
  const cues = Array.isArray(preset.preview_cues) ? preset.preview_cues : [];
  if (cues.length === 0) return { ok: false, error: 'Add at least one cue before publishing.' };
  const parsed = z.array(ShowPresetCueSchema).safeParse(cues);
  if (!parsed.success) return { ok: false, error: 'Fix unresolved cues before publishing.' };
  const products = await loadCatalogueProducts(parsed.data.map((cue) => cue.catalogueItemId));
  if (!products) return { ok: false, error: 'Fix unresolved cues before publishing.' };
  const timelineValidation = validatePresetTimeline(
    parsed.data,
    new Map(Array.from(products, ([id, product]) => [id, product.durationSeconds])),
    preset.duration_seconds,
  );
  if (!timelineValidation.ok) return timelineValidation;
  return { ok: true, slug: preset.slug };
}

function firstJoinedCatalogueItem(
  value: GeneratedShowCueRow['catalogue_items'],
): { part_number: string; name: string } | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function previewCuesFromTimeline(
  cues: GeneratedShowCueRow[],
): { ok: true; cues: Json } | { ok: false; error: string } {
  const previewCues: Json[] = [];
  for (const cue of cues) {
    const item = firstJoinedCatalogueItem(cue.catalogue_items);
    const timeSeconds = Number(cue.time_seconds);
    if (
      !cue.catalogue_item_id ||
      cue.time_seconds == null ||
      !Number.isFinite(timeSeconds) ||
      timeSeconds < 0 ||
      !item?.part_number
    ) {
      return {
        ok: false,
        error: `Timeline cue ${cue.position} has no usable catalogue item or start time.`,
      };
    }
    previewCues.push({
      catalogueItemId: cue.catalogue_item_id,
      catalogueItemSlug: item.part_number,
      timeSeconds,
      description: cue.description || item.name,
      launchPositionIndex: normaliseLaunchPositionIndex(cue.launch_position_index),
      emphasis: cue.emphasis === 'accent' || cue.emphasis === 'peak' ? cue.emphasis : 'normal',
    });
  }
  return { ok: true, cues: previewCues };
}

function presetInsertFromGeneratedShow(
  show: GeneratedShowRow,
  previewCues: Json,
  sortOrder = 0,
  slug = uniqueSlug(show.title),
) {
  const cueCount = Array.isArray(previewCues) ? previewCues.length : 0;
  return {
    slug,
    title: show.title,
    theme: show.mood_tags?.[0] ?? 'Imported generated show',
    description: show.description,
    duration_seconds: show.duration_seconds,
    budget_cents: show.budget_cents,
    total_cents: show.total_cents,
    effects_count: cueCount || show.effects_count,
    time_of_day: show.time_of_day,
    mood_tags: show.mood_tags ?? [],
    preview_cues: previewCues,
    cover_shader: show.cover_shader ?? randomCover(),
    cover_image_path: show.cover_image_path,
    is_featured: false,
    is_published: false,
    published_at: null,
    sort_order: sortOrder,
    source_show_id: show.id,
  };
}

async function loadExistingPresetSlugs(
  supabase: ReturnType<typeof createClient>,
  slugs: string[],
): Promise<Set<string> | null> {
  if (slugs.length === 0) return new Set();
  const existing = new Set<string>();
  for (let index = 0; index < slugs.length; index += INSERT_CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('show_presets')
      .select('slug')
      .in('slug', slugs.slice(index, index + INSERT_CHUNK_SIZE));
    if (error) return null;
    for (const row of data ?? []) existing.add(row.slug);
  }
  return existing;
}

async function loadCompletedGeneratedShows(service: ServiceClient): Promise<GeneratedShowRow[]> {
  const shows: GeneratedShowRow[] = [];
  for (let from = 0; ; from += BULK_IMPORT_PAGE_SIZE) {
    const { data, error } = await service
      .from('shows')
      .select(GENERATED_SHOW_SELECT)
      .eq('generation_status', 'completed')
      .order('updated_at', { ascending: true })
      .range(from, from + BULK_IMPORT_PAGE_SIZE - 1);
    if (error) throw new Error(supabaseErrorMessage(error));
    const page = (data ?? []) as GeneratedShowRow[];
    shows.push(...page);
    if (page.length < BULK_IMPORT_PAGE_SIZE) break;
  }
  return shows;
}

async function loadTimelineCuesForShows(
  service: ServiceClient,
  showIds: string[],
): Promise<Map<string, GeneratedShowCueRow[]>> {
  const cuesByShowId = new Map<string, GeneratedShowCueRow[]>();
  for (let index = 0; index < showIds.length; index += BULK_IMPORT_PAGE_SIZE) {
    const batchIds = showIds.slice(index, index + BULK_IMPORT_PAGE_SIZE);
    const { data, error } = await service
      .from('show_timeline_items')
      .select(GENERATED_SHOW_CUE_SELECT)
      .in('show_id', batchIds)
      .order('show_id', { ascending: true })
      .order('position', { ascending: true });
    if (error) throw new Error(supabaseErrorMessage(error));

    for (const cue of (data ?? []) as GeneratedShowCueRow[]) {
      const current = cuesByShowId.get(cue.show_id) ?? [];
      current.push(cue);
      cuesByShowId.set(cue.show_id, current);
    }
  }
  return cuesByShowId;
}

export async function createShowPreset(
  input: z.infer<typeof CreatePresetSchema>,
): Promise<CreateResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = CreatePresetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('show_presets')
    .insert({
      slug: uniqueSlug(parsed.data.title),
      title: parsed.data.title,
      theme: 'Draft curated show',
      description: null,
      duration_seconds: 60,
      budget_cents: null,
      total_cents: 0,
      effects_count: 0,
      mood_tags: [],
      preview_cues: [] as Json,
      cover_shader: randomCover(),
      is_featured: false,
      is_published: false,
      published_at: null,
      sort_order: 0,
    })
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Could not create preset.' };
  await refreshPresetPaths();
  return { ok: true, id: data.id };
}

export async function duplicateShowPreset(input: z.infer<typeof IdSchema>): Promise<CreateResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid preset.' };

  const supabase = createClient(await cookies());
  const { data: source, error: sourceError } = await supabase
    .from('show_presets')
    .select(
      'title, theme, description, duration_seconds, budget_cents, total_cents, effects_count, time_of_day, mood_tags, preview_cues, is_featured, sort_order, cover_shader, cover_image_path',
    )
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (sourceError) return { ok: false, error: sourceError.message };
  if (!source) return { ok: false, error: 'Preset not found.' };

  const { data, error } = await supabase
    .from('show_presets')
    .insert({
      ...source,
      slug: uniqueSlug(source.title),
      title: `${source.title} copy`,
      is_published: false,
      published_at: null,
    })
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Could not duplicate preset.' };
  await refreshPresetPaths();
  return { ok: true, id: data.id };
}

export async function updateShowPresetDetails(
  input: z.infer<typeof UpdateDetailsSchema>,
): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = UpdateDetailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { data: currentPreset, error: currentPresetError } = await supabase
    .from('show_presets')
    .select('preview_cues, is_published')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (currentPresetError) return { ok: false, error: currentPresetError.message };
  if (!currentPreset) return { ok: false, error: 'Preset not found.' };
  if (currentPreset.is_published) {
    const cues = z.array(ShowPresetCueSchema).safeParse(currentPreset.preview_cues);
    if (!cues.success) return { ok: false, error: 'Fix unresolved cues before saving details.' };
    const products = await loadCatalogueProducts(cues.data.map((cue) => cue.catalogueItemId));
    if (!products) return { ok: false, error: 'Fix unresolved cues before saving details.' };
    const timelineValidation = validatePresetTimeline(
      cues.data,
      new Map(Array.from(products, ([id, product]) => [id, product.durationSeconds])),
      parsed.data.durationSeconds,
    );
    if (!timelineValidation.ok) return timelineValidation;
  }

  const slug = parsed.data.slug ? slugifyTitle(parsed.data.slug) : slugifyTitle(parsed.data.title);
  const { data: updatedPreset, error } = await supabase
    .from('show_presets')
    .update({
      slug,
      title: parsed.data.title,
      theme: parsed.data.theme,
      description: parsed.data.description || null,
      duration_seconds: parsed.data.durationSeconds,
      budget_cents: parsed.data.budgetCents ?? null,
      time_of_day: parsed.data.timeOfDay || null,
      mood_tags: parsed.data.moodTags,
      is_featured: parsed.data.isFeatured,
      sort_order: parsed.data.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .select('slug')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!updatedPreset) return { ok: false, error: 'Preset not found.' };
  await refreshPresetPaths(updatedPreset.slug);
  return { ok: true };
}

export async function replaceShowPresetCues(
  input: z.infer<typeof ReplaceCuesSchema>,
): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = ReplaceCuesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = createClient(await cookies());
  const { data: presetState, error: presetStateError } = await supabase
    .from('show_presets')
    .select('duration_seconds, is_published')
    .eq('id', parsed.data.id)
    .maybeSingle();
  if (presetStateError) return { ok: false, error: presetStateError.message };
  if (!presetState) return { ok: false, error: 'Preset not found.' };
  if (presetState.is_published && parsed.data.cues.length === 0) {
    return { ok: false, error: 'Unpublish this preset before clearing its timeline.' };
  }

  const catalogueItemIds = parsed.data.cues.map((cue) => cue.catalogueItemId);
  const products = await loadCatalogueProducts(catalogueItemIds);
  if (!products) return { ok: false, error: 'One or more catalogue items could not be found.' };
  const timelineValidation = validatePresetTimeline(
    parsed.data.cues,
    new Map(Array.from(products, ([id, product]) => [id, product.durationSeconds])),
    presetState.duration_seconds,
  );
  if (!timelineValidation.ok) return timelineValidation;

  const cuePayload = parsed.data.cues
    .sort((a, b) => a.timeSeconds - b.timeSeconds)
    .map((cue) => ({
      catalogueItemId: cue.catalogueItemId,
      catalogueItemSlug: products.get(cue.catalogueItemId)?.slug ?? cue.catalogueItemSlug,
      timeSeconds: Number(cue.timeSeconds.toFixed(2)),
      description: cue.description,
      launchPositionIndex: cue.launchPositionIndex,
      emphasis: cue.emphasis,
    }));
  let totals: { totalCents: number; effectsCount: number };
  try {
    totals = await deriveCueTotals(supabase, catalogueItemIds);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not calculate totals.',
    };
  }

  const { data: preset, error } = await supabase
    .from('show_presets')
    .update({
      preview_cues: cuePayload as Json,
      effects_count: totals.effectsCount,
      total_cents: totals.totalCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .select('slug')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!preset) return { ok: false, error: 'Preset not found.' };
  await refreshPresetPaths(preset.slug);
  return { ok: true };
}

export async function setShowPresetPublished(
  input: z.infer<typeof PublishSchema>,
): Promise<Result> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = PublishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid preset.' };

  const supabase = createClient(await cookies());
  let slug: string | null = null;
  if (parsed.data.isPublished) {
    const publishable = await validatePublishablePreset(supabase, parsed.data.id);
    if (!publishable.ok) return publishable;
    slug = publishable.slug;
  }

  const publicationPatch = parsed.data.isPublished
    ? {
        is_published: true,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    : {
        is_published: false,
        updated_at: new Date().toISOString(),
      };
  const { data, error } = await supabase
    .from('show_presets')
    .update(publicationPatch)
    .eq('id', parsed.data.id)
    .select('slug')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Preset not found.' };
  await refreshPresetPaths(slug ?? data.slug);
  return { ok: true };
}

export async function importGeneratedShowAsPreset(
  input: z.infer<typeof ImportShowSchema>,
): Promise<CreateResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }
  const parsed = ImportShowSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid show.' };

  const service = createServiceRoleSupabase();
  if (!service) return { ok: false, error: 'Service role is not configured.' };

  const { data: show, error: showError } = await service
    .from('shows')
    .select(GENERATED_SHOW_SELECT)
    .eq('id', parsed.data.showId)
    .maybeSingle();
  if (showError) return { ok: false, error: showError.message };
  if (!show) return { ok: false, error: 'Show not found.' };
  if (show.generation_status !== 'completed') {
    return { ok: false, error: 'Only completed generated shows can be imported.' };
  }

  const { data: cues, error: cuesError } = await service
    .from('show_timeline_items')
    .select(GENERATED_SHOW_CUE_SELECT)
    .eq('show_id', show.id)
    .order('position', { ascending: true });
  if (cuesError) return { ok: false, error: cuesError.message };

  const convertedCues = previewCuesFromTimeline((cues ?? []) as GeneratedShowCueRow[]);
  if (!convertedCues.ok) return { ok: false, error: convertedCues.error };

  const supabase = createClient(await cookies());
  const { data: existingPreset, error: existingPresetError } = await supabase
    .from('show_presets')
    .select('id')
    .eq('source_show_id', show.id)
    .maybeSingle();
  if (existingPresetError) return { ok: false, error: existingPresetError.message };
  if (existingPreset) return { ok: true, id: existingPreset.id };

  const { data: preset, error } = await supabase
    .from('show_presets')
    .insert(presetInsertFromGeneratedShow(show as GeneratedShowRow, convertedCues.cues))
    .select('id')
    .maybeSingle();

  if (error?.code === '23505') {
    const { data: concurrentPreset } = await supabase
      .from('show_presets')
      .select('id')
      .eq('source_show_id', show.id)
      .maybeSingle();
    if (concurrentPreset) return { ok: true, id: concurrentPreset.id };
  }
  if (error) return { ok: false, error: error.message };
  if (!preset) return { ok: false, error: 'Could not import show.' };
  await refreshPresetPaths();
  return { ok: true, id: preset.id };
}

export async function importAllGeneratedShowsAsPresets(): Promise<BulkImportResult> {
  if (!(await requirePermission('admin.manage_catalogue'))) {
    return { ok: false, error: 'Not permitted.' };
  }

  const service = createServiceRoleSupabase();
  if (!service) return { ok: false, error: 'Service role is not configured.' };

  let shows: GeneratedShowRow[];
  let cuesByShowId: Map<string, GeneratedShowCueRow[]>;
  try {
    shows = await loadCompletedGeneratedShows(service);
    cuesByShowId = await loadTimelineCuesForShows(
      service,
      shows.map((show) => show.id),
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not load shows.' };
  }

  const supabase = createClient(await cookies());
  if (shows.length === 0) return { ok: true, importedCount: 0, skippedCount: 0, firstId: null };

  const existingSlugs = await loadExistingPresetSlugs(
    supabase,
    shows.map(importedGeneratedShowSlug),
  );
  if (!existingSlugs) return { ok: false, error: 'Could not check existing imported shows.' };

  const { data: importedPresets, error: importedPresetsError } = await supabase
    .from('show_presets')
    .select('source_show_id')
    .not('source_show_id', 'is', null);
  if (importedPresetsError) return { ok: false, error: importedPresetsError.message };
  const importedShowIds = new Set(
    (importedPresets ?? []).map((preset) => preset.source_show_id).filter(Boolean),
  );

  const rows: ReturnType<typeof presetInsertFromGeneratedShow>[] = [];
  for (const [index, show] of shows.entries()) {
    const slug = importedGeneratedShowSlug(show);
    if (importedShowIds.has(show.id) || existingSlugs.has(slug)) continue;
    const convertedCues = previewCuesFromTimeline(cuesByShowId.get(show.id) ?? []);
    if (!convertedCues.ok) {
      return { ok: false, error: `Could not import ${show.title}: ${convertedCues.error}` };
    }
    rows.push(presetInsertFromGeneratedShow(show, convertedCues.cues, index, slug));
  }

  let importedCount = 0;
  let firstId: string | null = null;
  for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('show_presets')
      .insert(rows.slice(index, index + INSERT_CHUNK_SIZE))
      .select('id');
    if (error) return { ok: false, error: supabaseErrorMessage(error) };

    importedCount += data?.length ?? 0;
    firstId ??= data?.[0]?.id ?? null;
  }

  await refreshPresetPaths();
  return { ok: true, importedCount, skippedCount: shows.length - rows.length, firstId };
}
