import 'server-only';

import { createHash, randomBytes, randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/database.types';
import { createServiceRoleSupabase } from '@/utils/supabase/service-role';

const PUBLIC_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const ASSORTMENT_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
]);

type ServiceClient = SupabaseClient<Database>;

export type PublicAssortmentItem = {
  catalogueItemId: string;
  name: string;
  partNumber: string;
  manufacturer: string | null;
  quantity: number;
};

export type PublicAssortment = {
  id: string;
  token: string;
  fundingUserId: string;
  name: string;
  description: string | null;
  priceCents: number;
  items: PublicAssortmentItem[];
};

export type AssortmentSongSelection = {
  id: string;
  assortmentId: string;
  fundingUserId: string;
  audioPath: string;
  contentType: string;
  sizeBytes: number;
  originalFilename: string | null;
  musicAnalysisId: string | null;
  expiresAt: string;
};

export type PublicAssortmentShow = {
  id: string;
  assortmentId: string;
  selectionId: string;
  title: string;
  durationSeconds: number | null;
  budgetCents: number | null;
  totalCents: number;
  effectsCount: number;
  audioPath: string | null;
  generationStatus: string;
  generationError: string | null;
  generatedCueCount: number | null;
  snapshotItems: PublicAssortmentItem[];
};

function requireServiceClient(): ServiceClient {
  const client = createServiceRoleSupabase();
  if (!client) throw new Error('Assortment QR entry requires SUPABASE_SERVICE_ROLE_KEY.');
  return client;
}

export function isAssortmentPublicToken(value: string): boolean {
  return PUBLIC_TOKEN_PATTERN.test(value);
}

export function hashCapabilityToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createCapabilityToken(): string {
  return randomBytes(32).toString('hex');
}

export async function getPublicAssortmentByToken(token: string): Promise<PublicAssortment | null> {
  if (!isAssortmentPublicToken(token)) return null;
  const supabase = requireServiceClient();
  const { data: link, error: linkError } = await supabase
    .from('assortment_public_links')
    .select('assortment_id, funding_user_id, public_token')
    .eq('public_token', token)
    .eq('is_enabled', true)
    .maybeSingle();

  if (linkError) {
    console.error('[assortment-qr] public link lookup failed:', linkError);
    throw new Error('The assortment could not be loaded.');
  }
  if (!link) return null;

  const { data, error } = await supabase
    .from('assortments')
    .select(
      `id, name, description, price_cents,
       assortment_items (
         quantity, sort_order,
         catalogue_items (id, name, part_number, manufacturer)
       )`,
    )
    .eq('id', link.assortment_id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[assortment-qr] public assortment lookup failed:', error);
    throw new Error('The assortment could not be loaded.');
  }
  if (!data) return null;

  const items = (data.assortment_items ?? [])
    .flatMap((item) => {
      const catalogueItem = Array.isArray(item.catalogue_items)
        ? item.catalogue_items[0]
        : item.catalogue_items;
      if (!catalogueItem) return [];
      return [
        {
          catalogueItemId: catalogueItem.id,
          name: catalogueItem.name,
          partNumber: catalogueItem.part_number,
          manufacturer: catalogueItem.manufacturer,
          quantity: item.quantity,
          sortOrder: item.sort_order,
        },
      ];
    })
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => ({
      catalogueItemId: item.catalogueItemId,
      name: item.name,
      partNumber: item.partNumber,
      manufacturer: item.manufacturer,
      quantity: item.quantity,
    }));

  if (items.length === 0) return null;
  return {
    id: data.id,
    token: link.public_token,
    fundingUserId: link.funding_user_id,
    name: data.name,
    description: data.description,
    priceCents: data.price_cents,
    items,
  };
}

function safeFilename(filename: string): string {
  const cleaned = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+/, '')
    .slice(0, 120);
  return cleaned || 'song';
}

export async function createAssortmentUpload(params: {
  assortment: PublicAssortment;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
}) {
  if (!ASSORTMENT_AUDIO_TYPES.has(params.contentType) || params.sizeBytes > MAX_AUDIO_BYTES) {
    throw new Error('Unsupported audio upload.');
  }

  const supabase = requireServiceClient();
  const selectionId = randomUUID();
  const selectionToken = createCapabilityToken();
  const filename = safeFilename(params.originalFilename);
  const audioPath = `${params.assortment.fundingUserId}/assortment-qr/${selectionId}-${filename}`;
  const { error: insertError } = await supabase.from('assortment_song_selections').insert({
    id: selectionId,
    assortment_id: params.assortment.id,
    funding_user_id: params.assortment.fundingUserId,
    access_token_hash: hashCapabilityToken(selectionToken),
    audio_path: audioPath,
    original_filename: params.originalFilename.slice(0, 180),
    content_type: params.contentType,
    size_bytes: params.sizeBytes,
  });
  if (insertError) {
    console.error('[assortment-qr] song selection insert failed:', insertError);
    throw new Error('The song upload could not be prepared.');
  }

  const { data: signedUpload, error: signedUploadError } = await supabase.storage
    .from('audio')
    .createSignedUploadUrl(audioPath);
  if (signedUploadError || !signedUpload?.token) {
    await supabase.from('assortment_song_selections').delete().eq('id', selectionId);
    console.error('[assortment-qr] signed upload creation failed:', signedUploadError);
    throw new Error('The song upload could not be prepared.');
  }

  return {
    selectionToken,
    path: audioPath,
    uploadToken: signedUpload.token,
  };
}

export async function resolveAssortmentSongSelection(params: {
  assortmentId: string;
  selectionToken: string;
  requireUnexpired?: boolean;
}): Promise<AssortmentSongSelection | null> {
  if (!PUBLIC_TOKEN_PATTERN.test(params.selectionToken)) return null;
  const supabase = requireServiceClient();
  let query = supabase
    .from('assortment_song_selections')
    .select(
      'id, assortment_id, funding_user_id, audio_path, content_type, size_bytes, original_filename, music_analysis_id, expires_at',
    )
    .eq('assortment_id', params.assortmentId)
    .eq('access_token_hash', hashCapabilityToken(params.selectionToken));
  if (params.requireUnexpired !== false) query = query.gt('expires_at', new Date().toISOString());
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('[assortment-qr] song selection lookup failed:', error);
    throw new Error('The song selection could not be loaded.');
  }
  if (!data?.assortment_id) return null;
  return {
    id: data.id,
    assortmentId: data.assortment_id,
    fundingUserId: data.funding_user_id,
    audioPath: data.audio_path,
    contentType: data.content_type,
    sizeBytes: data.size_bytes,
    originalFilename: data.original_filename,
    musicAnalysisId: data.music_analysis_id,
    expiresAt: data.expires_at,
  };
}

export async function verifyAssortmentAudioUpload(
  selection: AssortmentSongSelection,
): Promise<boolean> {
  const supabase = requireServiceClient();
  const separator = selection.audioPath.lastIndexOf('/');
  const directory = selection.audioPath.slice(0, separator);
  const filename = selection.audioPath.slice(separator + 1);
  if (!directory || !filename) return false;

  const { data, error } = await supabase.storage.from('audio').list(directory, {
    limit: 2,
    search: filename,
  });
  if (error) {
    console.error('[assortment-qr] uploaded audio metadata lookup failed:', error);
    return false;
  }
  const object = (data ?? []).find((candidate) => candidate.name === filename);
  const metadata = object?.metadata as Record<string, unknown> | undefined;
  const storedSize = Number(metadata?.size);
  const storedType =
    typeof metadata?.mimetype === 'string'
      ? metadata.mimetype
      : typeof metadata?.contentType === 'string'
        ? metadata.contentType
        : '';
  return (
    Boolean(object) &&
    Number.isFinite(storedSize) &&
    storedSize === selection.sizeBytes &&
    storedSize <= MAX_AUDIO_BYTES &&
    storedType === selection.contentType &&
    ASSORTMENT_AUDIO_TYPES.has(storedType)
  );
}

type PrepareAnalysisResult = {
  ok?: boolean;
  analysisId?: string;
  fundingUserId?: string;
};

export async function prepareAssortmentSongAnalysis(params: {
  assortmentToken: string;
  selectionId: string;
}) {
  const supabase = requireServiceClient();
  const analysisId = randomUUID();
  const { data, error } = await supabase.rpc('prepare_assortment_song_analysis', {
    p_assortment_token: params.assortmentToken,
    p_selection_id: params.selectionId,
    p_analysis_id: analysisId,
  });
  if (error) {
    console.error('[assortment-qr] analysis preparation failed:', error);
    throw new Error(
      error.message.includes('enough AI credits')
        ? 'This retailer has temporarily reached its generation limit.'
        : 'The song could not be prepared for analysis.',
    );
  }
  const result = data as PrepareAnalysisResult | null;
  if (!result?.ok || result.analysisId !== analysisId || !result.fundingUserId) {
    throw new Error('The song could not be prepared for analysis.');
  }
  return { supabase, analysisId, fundingUserId: result.fundingUserId };
}

type CreateShowResult = {
  ok?: boolean;
  showId?: string;
  showSlug?: string;
  fundingUserId?: string;
  musicAnalysisId?: string;
};

export async function createAssortmentShowRecord(params: {
  assortmentToken: string;
  selectionId: string;
  accessTokenHash: string;
  title: string;
  generationMode: 'fast' | 'llm';
  selectedCueModel: string | null;
  creditActionKey: string;
  coverShader: Json;
  sourceShowId?: string | null;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc('create_assortment_qr_show', {
    p_assortment_token: params.assortmentToken,
    p_selection_id: params.selectionId,
    p_public_access_token_hash: params.accessTokenHash,
    p_title: params.title,
    p_generation_mode: params.generationMode,
    p_selected_cue_model: params.selectedCueModel,
    p_credit_action_key: params.creditActionKey,
    p_cover_shader: params.coverShader,
    p_source_show_id: params.sourceShowId ?? null,
  });
  if (error) {
    console.error('[assortment-qr] show creation failed:', error);
    throw new Error(
      error.message.includes('enough AI credits')
        ? 'This retailer has temporarily reached its generation limit.'
        : 'The show could not be created.',
    );
  }
  const result = data as CreateShowResult | null;
  if (!result?.ok || !result.showId || !result.fundingUserId || !result.musicAnalysisId) {
    throw new Error('The show could not be created.');
  }
  return { supabase, ...result } as Required<CreateShowResult> & { supabase: ServiceClient };
}

export function getAssortmentServiceClient(): ServiceClient {
  return requireServiceClient();
}

export async function resolvePublicAssortmentShow(params: {
  assortmentId: string;
  showAccessToken: string;
}): Promise<PublicAssortmentShow | null> {
  if (!PUBLIC_TOKEN_PATTERN.test(params.showAccessToken)) return null;
  const supabase = requireServiceClient();
  const { data, error } = await supabase
    .from('shows')
    .select(
      `id, assortment_id, assortment_song_selection_id, title, duration_seconds,
       budget_cents, total_cents, effects_count, audio_path, generation_status,
       generation_error, generated_cue_count,
       show_assortment_items (
         quantity,
         catalogue_items (id, name, part_number, manufacturer)
       )`,
    )
    .eq('assortment_id', params.assortmentId)
    .eq('creation_source', 'assortment_qr')
    .eq('public_access_token_hash', hashCapabilityToken(params.showAccessToken))
    .maybeSingle();
  if (error) {
    console.error('[assortment-qr] public show lookup failed:', error);
    throw new Error('The generated show could not be loaded.');
  }
  if (!data?.assortment_id || !data.assortment_song_selection_id) return null;
  const snapshotItems = (data.show_assortment_items ?? []).flatMap((item) => {
    const catalogueItem = Array.isArray(item.catalogue_items)
      ? item.catalogue_items[0]
      : item.catalogue_items;
    if (!catalogueItem) return [];
    return [
      {
        catalogueItemId: catalogueItem.id,
        name: catalogueItem.name,
        partNumber: catalogueItem.part_number,
        manufacturer: catalogueItem.manufacturer,
        quantity: item.quantity,
      },
    ];
  });
  if (snapshotItems.length === 0) {
    throw new Error('The generated show has no assortment snapshot.');
  }
  return {
    id: data.id,
    assortmentId: data.assortment_id,
    selectionId: data.assortment_song_selection_id,
    title: data.title,
    durationSeconds: data.duration_seconds,
    budgetCents: data.budget_cents,
    totalCents: data.total_cents,
    effectsCount: data.effects_count,
    audioPath: data.audio_path,
    generationStatus: data.generation_status,
    generationError: data.generation_error,
    generatedCueCount: data.generated_cue_count,
    snapshotItems,
  };
}
