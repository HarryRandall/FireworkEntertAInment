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

export type PromptConfigActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
};

export async function updatePromptConfigAction(
  _previousState: PromptConfigActionState,
  formData: FormData,
): Promise<PromptConfigActionState> {
  const admin = await requirePermission('admin.manage_prompts');
  if (!admin) {
    return { status: 'error', message: 'You do not have permission to manage prompts.' };
  }

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
    return {
      status: 'error',
      message: 'Check the prompt text and selected catalogue fields, then try again.',
    };
  }

  const update: {
    p_key: (typeof parsed.data)['key'];
    p_system_prompt_text?: string;
    p_product_context_text?: string;
    p_product_catalogue_fields?: ReturnType<typeof asProductCatalogueFields>;
  } = { p_key: parsed.data.key };
  if (parsed.data.systemPromptText !== undefined) {
    update.p_system_prompt_text = parsed.data.systemPromptText;
  }
  if (parsed.data.productContextText !== undefined && parsed.data.key === 'show_cue_generation') {
    update.p_product_context_text = parsed.data.productContextText;
  }
  if (parsed.data.productCatalogueFields && parsed.data.key === 'show_cue_generation') {
    update.p_product_catalogue_fields = asProductCatalogueFields(
      parsed.data.productCatalogueFields,
    );
  }
  if (
    update.p_system_prompt_text === undefined &&
    update.p_product_context_text === undefined &&
    update.p_product_catalogue_fields === undefined
  ) {
    console.error('[updatePromptConfigAction] no fields to update');
    return { status: 'error', message: 'There is nothing to save.' };
  }

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc('update_prompt_config_atomically', update);

  if (error || data !== true) {
    console.error('[updatePromptConfigAction] failed:', error ?? 'RPC returned no confirmation');
    return { status: 'error', message: 'Could not save prompt settings. Try again.' };
  }

  await invalidateAdminPromptConfigsCache();
  revalidatePath('/admin/prompts');
  return { status: 'success', message: 'Prompt settings saved.' };
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
  const { data, error } = await supabase.rpc('update_show_generation_mode', {
    p_generation_mode: parsed.data.generationMode,
  });

  if (error || data !== true) {
    console.error(
      '[updateShowGenerationModeAction] failed:',
      error ?? 'RPC returned no confirmation',
    );
    return { ok: false, error: 'Could not save generation mode.' };
  }

  await invalidateAdminPromptConfigsCache();
  revalidatePath('/admin/prompts');
  return { ok: true, generationMode: parsed.data.generationMode };
}
