/**
 * Read-side helpers for admin prompt configuration.
 *
 * These rows contain the editable OpenRouter prompt families. Access is gated
 * by RBAC before reading because prompt text should only be visible to admins
 * who are allowed to edit it.
 */
import 'server-only';

import { getCachedJson, setCachedJson } from '@/lib/server-cache';
import type { Database } from '@/lib/database.types';
import {
  asGenerationMode,
  asProductCatalogueFields,
  type GenerationSetting,
  type PromptConfig,
  type PromptConfigKey,
} from '@/lib/prompt-configs';
import { getDefaultShowGenerationSettings } from '@/lib/prompt-configs.server';
import {
  ADMIN_CACHE_TTL_SECONDS,
  getAdminGenerationSettingsCacheKey,
  getAdminPromptConfigsCacheKey,
} from './cache-keys';
import { requirePermission } from './current-user.server';
import { getServerClient } from './supabase';

type PromptConfigRow = Database['public']['Tables']['prompt_configs']['Row'];
type GenerationSettingRow = Database['public']['Tables']['generation_settings']['Row'];

export type AdminPromptControlData = {
  configs: PromptConfig[];
  generationSetting: GenerationSetting;
};

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

function mapGenerationSetting(row: GenerationSettingRow): GenerationSetting {
  return {
    key: 'show_cue_generation',
    generationMode: asGenerationMode(row.generation_mode),
    productCatalogueFields: asProductCatalogueFields(row.product_catalogue_fields),
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fallbackGenerationSetting(): GenerationSetting {
  return getDefaultShowGenerationSettings();
}

export async function listAdminPromptConfigs(): Promise<PromptConfig[] | null> {
  if (!(await requirePermission('admin.manage_prompts'))) return null;

  const cacheKey = getAdminPromptConfigsCacheKey();
  const cached = await getCachedJson<PromptConfig[]>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('prompt_configs')
    .select(
      'key, name, description, system_prompt_text, product_context_text, is_active, updated_by, created_at, updated_at',
    )
    .order('name', { ascending: true });

  if (error) {
    console.error('[admin.prompts] listAdminPromptConfigs failed:', error);
    return [];
  }

  const mapped = ((data ?? []) as PromptConfigRow[]).map(mapPromptConfig);
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}

export async function getAdminPromptControlData(): Promise<AdminPromptControlData | null> {
  if (!(await requirePermission('admin.manage_prompts'))) return null;

  const promptConfigsCacheKey = getAdminPromptConfigsCacheKey();
  const generationSettingsCacheKey = getAdminGenerationSettingsCacheKey();
  const [cachedConfigs, cachedGenerationSetting] = await Promise.all([
    getCachedJson<PromptConfig[]>(promptConfigsCacheKey),
    getCachedJson<GenerationSetting>(generationSettingsCacheKey),
  ]);

  if (cachedConfigs && cachedGenerationSetting) {
    return {
      configs: cachedConfigs,
      generationSetting: cachedGenerationSetting,
    };
  }

  const supabase = await getServerClient();
  const [configsResult, generationSettingResult] = await Promise.all([
    cachedConfigs
      ? Promise.resolve(null)
      : supabase
          .from('prompt_configs')
          .select(
            'key, name, description, system_prompt_text, product_context_text, is_active, updated_by, created_at, updated_at',
          )
          .order('name', { ascending: true }),
    cachedGenerationSetting
      ? Promise.resolve(null)
      : supabase
          .from('generation_settings')
          .select(
            'key, generation_mode, product_catalogue_fields, updated_by, created_at, updated_at',
          )
          .eq('key', 'show_cue_generation')
          .maybeSingle(),
  ]);

  let configs = cachedConfigs;
  if (!configs) {
    if (configsResult?.error) {
      console.error(
        '[admin.prompts] getAdminPromptControlData configs failed:',
        configsResult.error,
      );
      configs = [];
    } else {
      configs = ((configsResult?.data ?? []) as PromptConfigRow[]).map(mapPromptConfig);
      await setCachedJson(promptConfigsCacheKey, configs, ADMIN_CACHE_TTL_SECONDS);
    }
  }

  let generationSetting = cachedGenerationSetting;
  if (!generationSetting) {
    generationSetting =
      generationSettingResult?.error || !generationSettingResult?.data
        ? fallbackGenerationSetting()
        : mapGenerationSetting(generationSettingResult.data as GenerationSettingRow);

    if (!generationSettingResult?.error) {
      await setCachedJson(generationSettingsCacheKey, generationSetting, ADMIN_CACHE_TTL_SECONDS);
    }
  }

  return {
    configs,
    generationSetting,
  };
}

export async function getAdminShowGenerationSetting(): Promise<GenerationSetting | null> {
  if (!(await requirePermission('admin.manage_prompts'))) return null;

  const cacheKey = getAdminGenerationSettingsCacheKey();
  const cached = await getCachedJson<GenerationSetting>(cacheKey);
  if (cached) return cached;

  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('generation_settings')
    .select('key, generation_mode, product_catalogue_fields, updated_by, created_at, updated_at')
    .eq('key', 'show_cue_generation')
    .maybeSingle();

  if (error) {
    return fallbackGenerationSetting();
  }

  const mapped = data
    ? mapGenerationSetting(data as GenerationSettingRow)
    : fallbackGenerationSetting();
  await setCachedJson(cacheKey, mapped, ADMIN_CACHE_TTL_SECONDS);
  return mapped;
}
