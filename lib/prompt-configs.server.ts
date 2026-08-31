import 'server-only';

import { createServiceRoleSupabase } from '@/utils/supabase/service-role';
import type { Database } from '@/lib/database.types';
import {
  asGenerationMode,
  asProductCatalogueFields,
  type GenerationSetting,
  type GenerationMode,
  type PromptConfig,
  type PromptConfigKey,
} from '@/lib/prompt-configs';

type PromptConfigRow = Database['public']['Tables']['prompt_configs']['Row'];
type GenerationSettingRow = Database['public']['Tables']['generation_settings']['Row'];

function mapPromptConfig(row: PromptConfigRow): PromptConfig {
  return {
    key: row.key as PromptConfigKey,
    name: row.name,
    description: row.description,
    systemPromptText: row.system_prompt_text,
    productContextText: row.product_context_text,
    isActive: row.is_active,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Trusted server-side prompt lookup for generation jobs. This deliberately
 * uses the service role so normal show creators do not need prompt permissions
 * and prompt text is never exposed through browser clients.
 */
export async function getActivePromptConfig(key: PromptConfigKey): Promise<PromptConfig | null> {
  const service = createServiceRoleSupabase();
  if (!service) return null;

  const { data, error } = await service
    .from('prompt_configs')
    .select(
      'key, name, description, system_prompt_text, product_context_text, is_active, updated_by, created_at, updated_at',
    )
    .eq('key', key)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[prompt-configs] getActivePromptConfig failed:', error);
    return null;
  }

  return data ? mapPromptConfig(data as PromptConfigRow) : null;
}

export function getDefaultShowGenerationMode(): GenerationMode {
  return process.env.CUE_GENERATION_MODE === 'llm' ? 'llm' : 'fast';
}

export function getDefaultShowGenerationSettings(): GenerationSetting {
  return {
    key: 'show_cue_generation',
    generationMode: getDefaultShowGenerationMode(),
    productCatalogueFields: asProductCatalogueFields(null),
    updatedBy: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

export async function getShowCueGenerationSettings(): Promise<GenerationSetting> {
  const fallback = getDefaultShowGenerationSettings();
  const service = createServiceRoleSupabase();
  if (!service) return fallback;

  const { data, error } = await service
    .from('generation_settings')
    .select('key, generation_mode, product_catalogue_fields, updated_by, created_at, updated_at')
    .eq('key', 'show_cue_generation')
    .maybeSingle();

  if (error) {
    console.warn('[prompt-configs] getShowCueGenerationMode fallback:', error);
    return fallback;
  }

  const row = data as GenerationSettingRow | null;
  if (!row) return fallback;

  return {
    key: 'show_cue_generation',
    generationMode: asGenerationMode(row.generation_mode),
    productCatalogueFields: asProductCatalogueFields(row.product_catalogue_fields),
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getShowCueGenerationMode(): Promise<GenerationMode> {
  return (await getShowCueGenerationSettings()).generationMode;
}
