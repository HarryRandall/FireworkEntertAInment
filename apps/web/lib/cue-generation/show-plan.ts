/**
 * Section-level show plan.
 *
 * The plan is the creative layer of generation: for every analysed section it
 * records the section's dramatic role, how dense it should be, which colours
 * and effect families it uses, how it moves across launch positions and which
 * products headline it. The LLM writes this plan; a deterministic default
 * exists for fast generation and as the fallback when the model fails.
 * Timing, lift compensation and safety stay in the realiser.
 */
import { z } from 'zod';
import { vibeForSectionLabel, type SlotVibe } from '@/lib/beat-grid.server';
import type { FireworkSpecification } from '@/lib/show-domain';
import type { AnalyserResult } from '@/lib/show-analysis.types';
import type { CreativeDirection } from './creative-direction';
import {
  productColourFamilies,
  productEffectFamilies,
  type ColourFamily,
  type EffectFamily,
  type PromptConstraints,
} from './prompt-constraints';
import { clamp } from '@/lib/utils';

export const SECTION_ROLES = [
  'opener',
  'body',
  'lull',
  'build',
  'peak',
  'finale',
  'outro',
] as const;
export type SectionRole = (typeof SECTION_ROLES)[number];

/** How a section moves across launch positions. */
export const MOTIFS = ['unison', 'mirror', 'alternate', 'chase', 'sweep'] as const;
export type Motif = (typeof MOTIFS)[number];

/** 0 = every other bar, 1 = every bar, 2 = half bars, 3 = every beat, 4 = beats and off-beats. */
export type DensityLevel = 0 | 1 | 2 | 3 | 4;

export const COLOUR_FAMILIES = [
  'red',
  'green',
  'blue',
  'purple',
  'gold',
  'white',
  'silver',
  'orange',
  'pink',
] as const satisfies readonly ColourFamily[];

export const EFFECT_FAMILIES = [
  'crackle',
  'strobe',
  'ring',
  'crossette',
  'horsetail',
  'floral',
  'falling leaves',
  'glitter',
  'willow',
] as const satisfies readonly EffectFamily[];

/** Analysed section with the context both the prompt and the realiser need. */
export type PlanSection = {
  index: number;
  start: number;
  end: number;
  label: string;
  vibe: SlotVibe;
  /** Mean local energy, 0-1. */
  energy: number;
  /** Energy percentile among sections: 0 quietest, 1 loudest. */
  energyRank: number;
  containsClimax: boolean;
  inFinaleWindow: boolean;
};

export type SectionDirection = {
  role: SectionRole;
  density: DensityLevel;
  palette: ColourFamily[];
  effects: EffectFamily[];
  motif: Motif;
  /** Catalogue product ids that headline this section's strongest moments. */
  heroProductIds: string[];
};

export type ShowPlan = {
  source: 'llm' | 'default';
  narrative: string;
  sections: SectionDirection[];
};

const MIN_SECTION_SECONDS = 4;
const SYNTHETIC_SECTION_SECONDS = 20;

/**
 * Normalise analysed sections into a contiguous list covering the song.
 * Very short sections merge into their predecessor so the plan never asks
 * for a role change every couple of beats.
 */
export function buildPlanSections(
  analysis: AnalyserResult | null,
  songDuration: number,
): PlanSection[] {
  const raw = (analysis?.sections ?? [])
    .filter((section) => Number.isFinite(section.start) && Number.isFinite(section.end))
    .map((section) => ({
      start: Math.max(0, section.start),
      end: Math.min(songDuration, section.end),
      label: section.label,
      energy: section.avg_energy,
    }))
    .filter((section) => section.end > section.start)
    .sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number; label: string; energy: number }> = [];
  for (const section of raw.length ? raw : syntheticSections(songDuration)) {
    const previous = merged.at(-1);
    if (previous && section.end - section.start < MIN_SECTION_SECONDS) {
      previous.end = section.end;
      continue;
    }
    if (previous) previous.end = section.start;
    merged.push({ ...section });
  }
  const first = merged[0];
  const last = merged.at(-1);
  if (!first || !last) return [];
  first.start = 0;
  last.end = songDuration;

  const timeline = analysis?.energy_timeline ?? [];
  const energies = merged.map((section) => {
    const points = timeline.filter(
      (point) => point.time >= section.start && point.time < section.end,
    );
    const local = points.length
      ? points.reduce((sum, point) => sum + point.energy, 0) / points.length
      : section.energy;
    return clamp(Number.isFinite(local) ? local : 0.5);
  });
  const ranked = [...energies].sort((a, b) => a - b);
  const climaxes = (analysis?.key_moments ?? []).filter((moment) => moment.type === 'climax');
  const finale = analysis?.derived?.finale_window ?? null;

  return merged.map((section, index) => {
    const energy = energies[index] ?? 0.5;
    const rank = ranked.length > 1 ? ranked.indexOf(energy) / (ranked.length - 1) : 0.5;
    return {
      index,
      start: round3(section.start),
      end: round3(section.end),
      label: section.label,
      vibe: vibeForSectionLabel(section.label),
      energy: round3(energy),
      energyRank: round3(rank),
      containsClimax: climaxes.some(
        (moment) => moment.time >= section.start && moment.time < section.end,
      ),
      inFinaleWindow: finale != null && section.end > finale.start && section.start < finale.end,
    };
  });
}

/** Without analysis, pace a gentle rise in equal phrases so fast generation still has shape. */
function syntheticSections(songDuration: number) {
  const count = Math.max(1, Math.round(songDuration / SYNTHETIC_SECTION_SECONDS));
  const length = songDuration / count;
  return Array.from({ length: count }, (_, index) => ({
    start: index * length,
    end: (index + 1) * length,
    label: index === 0 ? 'intro' : index === count - 1 ? 'finale' : `section ${index + 1}`,
    energy: count === 1 ? 0.6 : 0.35 + (0.55 * index) / (count - 1),
  }));
}

/** Catalogue families that actually exist, ordered by how many products carry them. */
export type CataloguePalette = {
  colours: ColourFamily[];
  effects: EffectFamily[];
};

export function describeCataloguePalette(products: FireworkSpecification[]): CataloguePalette {
  const colourCounts = new Map<ColourFamily, number>();
  const effectCounts = new Map<EffectFamily, number>();
  for (const product of products) {
    for (const colour of productColourFamilies(product)) {
      colourCounts.set(colour, (colourCounts.get(colour) ?? 0) + 1);
    }
    for (const effect of productEffectFamilies(product)) {
      effectCounts.set(effect, (effectCounts.get(effect) ?? 0) + 1);
    }
  }
  const byCount = <T extends string>(counts: Map<T, number>) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
  return { colours: byCount(colourCounts), effects: byCount(effectCounts) };
}

const ROLE_EFFECTS: Record<SectionRole, EffectFamily[]> = {
  opener: ['ring', 'floral', 'glitter'],
  body: ['floral', 'ring', 'crossette', 'glitter'],
  lull: ['willow', 'horsetail', 'falling leaves', 'glitter'],
  build: ['crackle', 'glitter', 'strobe'],
  peak: ['crossette', 'strobe', 'crackle', 'ring'],
  finale: ['crackle', 'willow', 'glitter', 'strobe'],
  outro: ['willow', 'falling leaves', 'glitter'],
};

const ROLE_MOTIFS: Record<SectionRole, Motif[]> = {
  opener: ['mirror', 'unison'],
  body: ['chase', 'alternate', 'sweep'],
  lull: ['alternate', 'mirror'],
  build: ['sweep', 'chase'],
  peak: ['mirror', 'unison', 'chase'],
  finale: ['unison', 'mirror'],
  outro: ['mirror', 'alternate'],
};

const SOFT_COLOURS: ColourFamily[] = ['gold', 'white', 'silver'];

/**
 * Deterministic plan from the song's shape. Roles come from relative energy,
 * so every song gets real troughs and a finale that is its densest passage.
 */
export function buildDefaultShowPlan(params: {
  sections: PlanSection[];
  direction: CreativeDirection;
  constraints: PromptConstraints;
  palette: CataloguePalette;
}): ShowPlan {
  const { sections, direction, constraints, palette } = params;
  const roles = defaultRoles(sections, direction);
  const familyPalettes = new Map<string, ColourFamily[]>();
  const saturated = palette.colours.filter((colour) => !SOFT_COLOURS.includes(colour));
  const softColours = palette.colours.filter((colour) => SOFT_COLOURS.includes(colour));
  let paletteRotor = 0;

  const directions = sections.map((section, index): SectionDirection => {
    const role = roles[index] ?? 'body';
    // Repeated section labels (chorus 1 and chorus 2) share a palette so the
    // audience recognises the return; new material gets the next colours.
    const soft = role === 'lull' || role === 'outro';
    const family = `${section.label.replace(/\s*\d+$/, '').toLowerCase()}:${soft ? 'soft' : 'bold'}`;
    let colours = familyPalettes.get(family);
    if (!colours) {
      colours = paletteForRole(role, saturated, softColours, paletteRotor);
      paletteRotor += 1;
      familyPalettes.set(family, colours);
    }
    const effects = ROLE_EFFECTS[role].filter((effect) => palette.effects.includes(effect));
    const motifs = ROLE_MOTIFS[role];
    return {
      role,
      density: densityFor(role, section, direction, index / Math.max(1, sections.length - 1)),
      palette: unique([...constraints.requiredColours, ...colours]),
      effects: unique([...constraints.requestedEffects, ...effects]).slice(0, 4),
      motif: motifs[index % motifs.length] ?? 'mirror',
      heroProductIds: [],
    };
  });

  return {
    source: 'default',
    narrative:
      'Structure follows the song energy: quiet passages breathe, choruses build, and the finale is the densest passage.',
    sections: directions,
  };
}

function defaultRoles(sections: PlanSection[], direction: CreativeDirection): SectionRole[] {
  const roles: SectionRole[] = sections.map((section) => {
    if (section.vibe === 'buildup' || section.vibe === 'pre-chorus') return 'build';
    if (section.energyRank >= 0.75 || (section.containsClimax && section.energyRank >= 0.55)) {
      return 'peak';
    }
    if (section.energyRank < 0.35) return 'lull';
    return 'body';
  });
  if (!sections.length) return roles;

  const lastIndex = sections.length - 1;
  const last = sections[lastIndex];
  const endsSoft =
    direction.softEnding || (last != null && last.energyRank < 0.35 && sections.length > 2);
  // Finale: the analyser's finale window, else the last loud section.
  let finaleIndex = sections.findIndex((section) => section.inFinaleWindow);
  if (finaleIndex < 0 || endsSoft) {
    finaleIndex = -1;
    for (let index = lastIndex; index >= Math.max(0, lastIndex - 2); index -= 1) {
      if ((sections[index]?.energyRank ?? 0) >= 0.5) {
        finaleIndex = index;
        break;
      }
    }
    if (finaleIndex < 0) finaleIndex = endsSoft && lastIndex > 0 ? lastIndex - 1 : lastIndex;
  }
  for (let index = finaleIndex; index <= lastIndex; index += 1) roles[index] = 'finale';
  if (endsSoft && finaleIndex < lastIndex) roles[lastIndex] = 'outro';
  // The section before the finale builds into it unless it is already a peak.
  if (finaleIndex > 1 && roles[finaleIndex - 1] !== 'peak') roles[finaleIndex - 1] = 'build';
  if (sections.length > 2 && roles[0] !== 'finale') roles[0] = 'opener';
  return roles;
}

function densityFor(
  role: SectionRole,
  section: PlanSection,
  direction: CreativeDirection,
  /** Position in the song, 0 first section to 1 last. */
  position: number,
): DensityLevel {
  const base: Record<SectionRole, number> = {
    opener: section.energyRank < 0.3 ? 1 : 2,
    body: section.energyRank >= 0.55 ? 2 : 1,
    lull: section.energyRank < 0.15 ? 0 : 1,
    build: 2,
    peak: 2,
    finale: 3,
    outro: 1,
  };
  const sparse = direction.density === 'sparse' || direction.style === 'minimalist';
  let shift = sparse ? -1 : direction.density === 'dense' ? 1 : 0;
  // Cinematic shows open quieter than the music and grow into the finale.
  if (direction.style === 'cinematic' && position < 0.4 && role !== 'finale') shift -= 1;
  const ceiling = role === 'lull' || role === 'outro' ? 2 : 4;
  const floor = role === 'finale' ? 2 : 0;
  return clampDensity(Math.min(ceiling, Math.max(floor, base[role] + shift)));
}

function paletteForRole(
  role: SectionRole,
  saturated: ColourFamily[],
  soft: ColourFamily[],
  rotor: number,
): ColourFamily[] {
  const pick = (list: ColourFamily[], count: number, offset: number) =>
    list.length
      ? Array.from(
          { length: Math.min(count, list.length) },
          (_, i) => list[(offset + i) % list.length],
        )
      : [];
  if (role === 'lull' || role === 'outro') {
    return unique([...pick(soft, 2, 0), ...pick(saturated, 1, rotor)]);
  }
  if (role === 'finale') return unique([...pick(soft, 1, 0), ...pick(saturated, 2, rotor)]);
  return unique([...pick(saturated, 2, rotor * 2), ...pick(soft, 1, rotor)]);
}

/**
 * The model's reply. Short aliases (p1, p2 ...) replace catalogue UUIDs so
 * the output stays small and cannot be truncated mid-id.
 */
export const LlmShowPlanSchema = z.object({
  narrative: z.string().trim().max(600).optional(),
  sections: z
    .array(
      z.object({
        s: z.number().int().min(0),
        role: z.enum(SECTION_ROLES).optional(),
        density: z.number().int().min(0).max(4).optional(),
        palette: z.array(z.string()).max(4).optional(),
        effects: z.array(z.string()).max(4).optional(),
        motif: z.enum(MOTIFS).optional(),
        heroes: z.array(z.string()).max(3).optional(),
      }),
    )
    .min(1)
    .max(64),
});
export type LlmShowPlan = z.infer<typeof LlmShowPlanSchema>;

/**
 * Merge a model plan with the deterministic default. Unknown colours, effects
 * and aliases are dropped individually; a missing section keeps its default.
 * Prompt requirements are always re-applied so the model cannot remove them.
 */
export function resolveShowPlan(params: {
  llmPlan: LlmShowPlan;
  fallback: ShowPlan;
  aliases: ReadonlyMap<string, string>;
  palette: CataloguePalette;
  constraints: PromptConstraints;
}): ShowPlan {
  const { llmPlan, fallback, aliases, palette, constraints } = params;
  const bySection = new Map(llmPlan.sections.map((section) => [section.s, section]));
  const knownColour = (value: string): value is ColourFamily =>
    (palette.colours as string[]).includes(value.toLowerCase());
  const knownEffect = (value: string): value is EffectFamily =>
    (palette.effects as string[]).includes(value.toLowerCase());

  const sections = fallback.sections.map((base, index): SectionDirection => {
    const proposed = bySection.get(index);
    if (!proposed) return base;
    const colours = (proposed.palette ?? []).map((c) => c.toLowerCase()).filter(knownColour);
    const effects = (proposed.effects ?? []).map((e) => e.toLowerCase()).filter(knownEffect);
    const heroes = (proposed.heroes ?? [])
      .map((alias) => aliases.get(alias.trim().toLowerCase()))
      .filter((id): id is string => id != null);
    return {
      role: proposed.role ?? base.role,
      density: proposed.density != null ? clampDensity(proposed.density) : base.density,
      palette: unique([
        ...constraints.requiredColours,
        ...(colours.length ? colours : base.palette),
      ]),
      effects: unique([
        ...constraints.requestedEffects,
        ...(effects.length ? effects : base.effects),
      ]),
      motif: proposed.motif ?? base.motif,
      heroProductIds: unique(heroes),
    };
  });

  return {
    source: 'llm',
    narrative: llmPlan.narrative?.trim() || fallback.narrative,
    sections,
  };
}

function clampDensity(value: number): DensityLevel {
  return Math.max(0, Math.min(4, Math.round(value))) as DensityLevel;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}
