/**
 * Pure helpers for the show-plan prompt.
 *
 * The model writes one short direction per analysed section; it never picks
 * individual beats, times or launch positions. Admin-authored guidance is
 * layered above an immutable output contract so a saved prompt can shape the
 * creative voice but cannot change the schema the runner parses.
 */
import { asProductCatalogueFields, type ProductCatalogueField } from '@/lib/prompt-configs';
import type { FireworkSpecification } from '@/lib/show-domain';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import { productColourFamilies, productEffectFamilies } from './prompt-constraints';
import { isGroundEffect } from './show-options';
import {
  MOTIFS,
  SECTION_ROLES,
  type CataloguePalette,
  type PlanSection,
  type ShowPlan,
} from './show-plan';
import { SHOW_STYLES, type ShowStyleKey } from './show-styles';

/** Enough products for real choice without letting a huge catalogue swamp the prompt. */
const MAX_PROMPT_PRODUCTS = 120;

/** Short aliases (p1, p2 ...) keep the reply small and impossible to truncate mid-UUID. */
export function productAliases(products: readonly FireworkSpecification[]) {
  const shown = products.slice(0, MAX_PROMPT_PRODUCTS);
  const aliasById = new Map(shown.map((product, index) => [product.id, `p${index + 1}`]));
  const idByAlias = new Map([...aliasById].map(([id, alias]) => [alias, id]));
  return { shown, aliasById, idByAlias };
}

function projectCatalogue(
  products: readonly FireworkSpecification[],
  aliasById: ReadonlyMap<string, string>,
  selectedFields?: readonly ProductCatalogueField[] | null,
) {
  const fields = new Set(asProductCatalogueFields(selectedFields));
  const include = (field: ProductCatalogueField) => fields.has(field);
  return products.flatMap((product) => {
    const alias = aliasById.get(product.id);
    if (!alias) return [];
    const shotCount = product.shotCount ?? 1;
    const description = include('description') ? compactText(product.description, 100) : null;
    return [
      {
        a: alias,
        ...(include('templateKey') ? { templateKey: product.baseEffect?.templateKey ?? null } : {}),
        ...(include('kind') ? { kind: product.kind ?? null } : {}),
        ...(include('name') ? { name: product.name } : {}),
        ...(description ? { description } : {}),
        colours: [...productColourFamilies(product)],
        ...(include('effects') ? { effects: [...productEffectFamilies(product)] } : {}),
        ...(include('caliber') && product.caliber ? { caliber: product.caliber } : {}),
        ...(include('heightMeters') && product.heightMeters != null
          ? { heightMeters: product.heightMeters }
          : {}),
        ...(include('shotCount') || include('isMultiShot') ? { shots: shotCount } : {}),
        ...(include('durationSeconds') && product.durationSeconds != null
          ? { seconds: product.durationSeconds }
          : {}),
        ...(isGroundEffect(product) ? { ground: true } : {}),
      },
    ];
  });
}

function projectSections(sections: readonly PlanSection[], fallback: ShowPlan) {
  return sections.map((section) => {
    const suggested = fallback.sections[section.index];
    return {
      s: section.index,
      start: Number(section.start.toFixed(1)),
      end: Number(section.end.toFixed(1)),
      label: section.label,
      energy: Number(section.energy.toFixed(2)),
      energyRank: Number(section.energyRank.toFixed(2)),
      ...(section.containsClimax ? { climax: true } : {}),
      ...(section.inFinaleWindow ? { finaleWindow: true } : {}),
      suggested: suggested
        ? { role: suggested.role, density: suggested.density, motif: suggested.motif }
        : null,
    };
  });
}

function buildSongSummary(analysis: AnalyserResult | null, songDuration: number) {
  if (!analysis) {
    return {
      durationSeconds: songDuration,
      note: 'No song analysis was available; sections are equal phrases on a synthetic 120 BPM grid.',
    };
  }
  return {
    durationSeconds: analysis.duration_seconds || songDuration,
    tempoBpm: analysis.tempo_bpm,
    beatsPerBar: analysis.beats_per_bar ?? 4,
    genre: analysis.music_profile?.genre_hint ?? null,
    traits: analysis.music_profile?.dominant_traits ?? [],
  };
}

export function buildPlanPayload(params: {
  userPrompt: string;
  brief: Record<string, unknown>;
  analysis: AnalyserResult | null;
  songDuration: number;
  sections: readonly PlanSection[];
  fallback: ShowPlan;
  palette: CataloguePalette;
  products: readonly FireworkSpecification[];
  aliasById: ReadonlyMap<string, string>;
  productCatalogueFields?: readonly ProductCatalogueField[] | null;
}) {
  return {
    userPrompt:
      params.userPrompt.trim() ||
      '(No prompt supplied. Design a tasteful show that follows the song structure.)',
    brief: params.brief,
    song: buildSongSummary(params.analysis, params.songDuration),
    sections: projectSections(params.sections, params.fallback),
    availableColours: params.palette.colours,
    availableEffects: params.palette.effects,
    catalogue: projectCatalogue(params.products, params.aliasById, params.productCatalogueFields),
  };
}

/** Editable creative guidance. The admin prompt page can replace this text. */
export const DEFAULT_SHOW_CUE_SYSTEM_PROMPT = [
  'You are a senior pyromusical designer. Plan a fireworks show for the song, section by section.',
  "The user's prompt is the most important creative direction; honour it over every default.",
  '',
  'What makes a great pyromusical:',
  '  - Contrast. Quiet passages are real troughs so the big moments read as big. Never run the whole song at full intensity; keep at least two clear lulls in a song longer than two minutes.',
  '  - Arc. Open with a confident statement, build tension through the verses, pay off in the choruses, and make the finale the densest and largest passage of the show.',
  '  - Character. Slow or emotional music suits willows, horsetails, falling leaves, glitter and soft gold or white. Percussive, fast music suits crackle, strobe, crossettes and bright saturated colours. Builds rise with crackle and glitter.',
  '  - Colour themes. Give each section one small palette (two or three colours). When a chorus returns, reuse its palette so the audience recognises it; change palette when the music changes.',
  '  - Space. Choose a motif per section: unison (everything together), mirror (symmetrical left and right), alternate (left, right), chase (left to right) or sweep (back and forth). Save unison for the biggest moments.',
  '  - Hold back. Keep the largest products for climaxes and the finale; use them sparingly before it.',
].join('\n');

/** Editable guidance about using the catalogue. */
const DEFAULT_SHOW_CUE_PRODUCT_CONTEXT_TEXT = [
  'Product context:',
  '  - The catalogue is the complete list of products for this show, referred to by alias (p1, p2 ...).',
  '  - Heroes are the products that headline a section: pick one to three whose colours and effects fit that section. Prefer large calibres for peak and finale heroes.',
  '  - Multi-shot products (shots above 1) make sustained layers; ground products suit low, gentle passages.',
].join('\n');

/** Immutable output contract. Always appended last and never editable. */
const PLAN_OUTPUT_CONTRACT = [
  'Output contract (overrides any conflicting instruction above):',
  `  - Return one entry per section index s. role is one of ${SECTION_ROLES.join(', ')}.`,
  '  - density is 0-4: 0 every other bar, 1 every bar, 2 twice a bar, 3 every beat, 4 beats and off-beats. Each section has a suggested role, density and motif from the song analysis; change them when you have a creative reason.',
  '  - palette uses only availableColours; effects uses only availableEffects (at most four each).',
  `  - motif is one of ${MOTIFS.join(', ')}.`,
  '  - heroes are catalogue aliases such as "p3" (at most three). Never invent aliases.',
  '  - You do not choose beats, times or launch positions. The engine places every burst on the beat, compensates lift time and enforces safety.',
  '  - Return ONLY this JSON object, with no prose or markdown:',
  '    { "narrative": "<one or two sentences>", "sections": [ { "s": 0, "role": "opener", "density": 1, "palette": ["gold","white"], "effects": ["willow"], "motif": "mirror", "heroes": ["p3"] } ] }',
].join('\n');

/** A saved prompt written for the retired per-slot contract would ask for the wrong schema. */
export function isLegacySlotPrompt(text: string): boolean {
  return /slotIndex/.test(text);
}

export function buildSystemPrompt(
  options: {
    systemPromptText?: string | null;
    productContextText?: string | null;
    productCatalogueFields?: readonly ProductCatalogueField[] | null;
    showStyle?: ShowStyleKey | null;
  } = {},
): { prompt: string; ignoredLegacyPrompt: boolean } {
  const saved = options.systemPromptText?.trim() ?? '';
  const ignoredLegacyPrompt = saved !== '' && isLegacySlotPrompt(saved);
  const guidance = saved && !ignoredLegacyPrompt ? saved : DEFAULT_SHOW_CUE_SYSTEM_PROMPT;
  const savedContext = options.productContextText?.trim() ?? '';
  const productContext =
    savedContext && !isLegacySlotPrompt(savedContext)
      ? savedContext
      : DEFAULT_SHOW_CUE_PRODUCT_CONTEXT_TEXT;
  const styleDirectives = options.showStyle
    ? (SHOW_STYLES[options.showStyle]?.promptDirectives ?? null)
    : null;
  const productFields = asProductCatalogueFields(options.productCatalogueFields);
  const fieldContext = `Catalogue fields sent in this request: ${productFields.join(', ')}. Do not assume omitted catalogue fields are available.`;

  return {
    prompt: [guidance, styleDirectives, productContext, fieldContext, PLAN_OUTPUT_CONTRACT]
      .filter(Boolean)
      .join('\n\n'),
    ignoredLegacyPrompt,
  };
}

function compactText(value: string | null | undefined, maxLength: number): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}
