'use server';

/** Admin prompt configuration actions. */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { invalidateAdminPromptConfigsCache, requirePermission } from '@/lib/admin.server';
import {
  asProductCatalogueFields,
  PRODUCT_CATALOGUE_FIELD_KEYS,
  PROMPT_CONFIG_KEYS,
} from '@/lib/prompt-configs';

const PromptConfigInput = z.object({
  key: z.enum(PROMPT_CONFIG_KEYS),
  systemPromptText: z.string().trim().min(40).max(60000).optional(),
  productContextText: z.string().trim().max(20000).optional(),
  productCatalogueFields: z.array(z.enum(PRODUCT_CATALOGUE_FIELD_KEYS)).optional(),
});

const GenerationModeInput = z.object({
  generationMode: z.enum(['fast', 'llm']),
});

type GenerationModeActionResult =
  | { ok: true; generationMode: 'fast' | 'llm' }
  | { ok: false; error: string };

export async function updatePromptConfigAction(formData: FormData): Promise<void> {
  const admin = await requirePermission('admin.manage_prompts');
  if (!admin) return;

  const systemPromptText = formData.get('systemPromptText');
  const productContextText = formData.get('productContextText');
  const productCatalogueFields = formData.getAll('productCatalogueFields');
  const parsed = PromptConfigInput.safeParse({
    key: formData.get('key'),
    systemPromptText: typeof systemPromptText === 'string' ? systemPromptText : undefined,
    productContextText: typeof productContextText === 'string' ? productContextText : undefined,
    productCatalogueFields: productCatalogueFields.length > 0 ? productCatalogueFields : undefined,
  });
  if (!parsed.success) {
    console.error('[updatePromptConfigAction] invalid input:', parsed.error.issues[0]?.message);
    return;
  }

  const update: {
    system_prompt_text?: string;
    product_context_text?: string | null;
    updated_by: string;
  } = { updated_by: admin.id };
  if (parsed.data.systemPromptText !== undefined) {
    update.system_prompt_text = parsed.data.systemPromptText;
  }
  if (parsed.data.productContextText !== undefined && parsed.data.key === 'show_cue_generation') {
    update.product_context_text = parsed.data.productContextText;
  }
  if (update.system_prompt_text === undefined && update.product_context_text === undefined) {
    console.error('[updatePromptConfigAction] no fields to update');
    return;
  }

  const supabase = createClient(await cookies());
  const { error: promptError } = await supabase
    .from('prompt_configs')
    .update(update)
    .eq('key', parsed.data.key);

  if (promptError) {
    console.error('[updatePromptConfigAction] failed:', promptError);
    return;
  }

  if (parsed.data.productCatalogueFields && parsed.data.key === 'show_cue_generation') {
    const { error: settingsError } = await supabase.from('generation_settings').upsert({
      key: 'show_cue_generation',
      product_catalogue_fields: asProductCatalogueFields(parsed.data.productCatalogueFields),
      updated_by: admin.id,
    });

    if (settingsError) {
      console.warn('[updatePromptConfigAction] product fields failed:', settingsError);
    }
  }

  await invalidateAdminPromptConfigsCache();
  revalidatePath('/admin/prompts');
}

export async function updateShowGenerationModeAction(
  formData: FormData,
): Promise<GenerationModeActionResult> {
  const admin = await requirePermission('admin.manage_prompts');
  if (!admin) return { ok: false, error: 'You do not have permission to manage prompts.' };

  const parsed = GenerationModeInput.safeParse({
    generationMode: formData.get('generationMode'),
  });
  if (!parsed.success) {
    console.error(
      '[updateShowGenerationModeAction] invalid input:',
      parsed.error.issues[0]?.message,
    );
    return { ok: false, error: 'Choose Fast or LLM mode.' };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.from('generation_settings').upsert({
    key: 'show_cue_generation',
    generation_mode: parsed.data.generationMode,
    updated_by: admin.id,
  });

  if (error) {
    console.warn('[updateShowGenerationModeAction] failed:', error);
    return { ok: false, error: 'Could not save generation mode.' };
  }

  await invalidateAdminPromptConfigsCache();
  revalidatePath('/admin/prompts');
  return { ok: true, generationMode: parsed.data.generationMode };
}
