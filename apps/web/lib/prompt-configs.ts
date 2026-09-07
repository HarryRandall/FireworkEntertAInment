export const PROMPT_CONFIG_KEYS = ['show_cue_generation', 'firework_video_reconstruction'] as const;

export const PRODUCT_CATALOGUE_FIELD_KEYS = [
  'id',
  'name',
  'description',
  'durationSeconds',
  'shotCount',
  'isMultiShot',
  'heightMeters',
  'caliber',
  'shellType',
  'color',
  'colorPalette',
  'effects',
] as const;

export type PromptConfigKey = (typeof PROMPT_CONFIG_KEYS)[number];
export type GenerationMode = 'fast' | 'llm';
export type ProductCatalogueField = (typeof PRODUCT_CATALOGUE_FIELD_KEYS)[number];

export type PromptConfig = {
  key: PromptConfigKey;
  name: string;
  description: string | null;
  systemPromptText: string;
  productContextText: string | null;
  isActive: boolean;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GenerationSetting = {
  key: 'show_cue_generation';
  generationMode: GenerationMode;
  productCatalogueFields: ProductCatalogueField[];
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isPromptConfigKey(value: unknown): value is PromptConfigKey {
  return typeof value === 'string' && (PROMPT_CONFIG_KEYS as readonly string[]).includes(value);
}

export function asGenerationMode(value: unknown): GenerationMode {
  return value === 'llm' ? 'llm' : 'fast';
}

export function asProductCatalogueFields(value: unknown): ProductCatalogueField[] {
  const allowed = new Set<string>(PRODUCT_CATALOGUE_FIELD_KEYS);
  const source = Array.isArray(value) ? value : PRODUCT_CATALOGUE_FIELD_KEYS;
  const fields = source.filter(
    (field): field is ProductCatalogueField => typeof field === 'string' && allowed.has(field),
  );
  const deduped = Array.from(new Set<ProductCatalogueField>(['id', ...fields]));
  return deduped.length > 1 ? deduped : ['id'];
}
