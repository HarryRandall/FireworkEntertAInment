import type { ShowTemplateCue } from '@/lib/admin.types';
import type { FireworkSpecification, ReplayCue } from '@/lib/show-domain';

export const TEMPLATE_REPLAY_ACTIVE_CUE_EVENT = 'showcrafter:template-replay-active-cue';

export type TemplateReplayActiveCueEventDetail = {
  templateSlug: string;
  cueId: string | null;
};

const FIREWORK_SLUG_ALIASES: Record<string, string> = {
  chrysanthemum: 'gold-chrysanthemum',
  comet: 'comet-gold',
  finale_barrage: 'white-strobe',
  peony: 'gold-chrysanthemum',
  willow: 'willow-gold',
};

export function toTemplateReplayCue(
  cue: ShowTemplateCue,
  index: number,
  specBySlug: Map<string, FireworkSpecification>,
  specById: Map<string, FireworkSpecification>,
): ReplayCue | null {
  const specs = [...specById.values()];
  const byLegacySlug = (slug: string | undefined): FireworkSpecification | undefined => {
    if (!slug) return undefined;
    return (
      specBySlug.get(slug) ??
      specs.find((spec) => spec.variant?.slug === slug) ??
      specs.find((spec) => spec.baseEffect?.slug === slug)
    );
  };
  const aliasSlug = cue.fireworkSlug ? FIREWORK_SLUG_ALIASES[cue.fireworkSlug] : undefined;
  const firework =
    (cue.catalogueItemId ? specById.get(cue.catalogueItemId) : undefined) ??
    (cue.catalogueItemSlug ? specBySlug.get(cue.catalogueItemSlug) : undefined) ??
    byLegacySlug(cue.fireworkSlug) ??
    byLegacySlug(aliasSlug);
  if (!firework) return null;
  const cueKey = cue.catalogueItemId ?? cue.catalogueItemSlug ?? cue.fireworkSlug ?? firework.slug;
  return {
    id: `${cueKey}-${cue.timeSeconds}-${index}`,
    position: index + 1,
    timeSeconds: cue.timeSeconds,
    description: cue.description,
    productId: firework.id,
    launchPositionIndex: cue.launchPositionIndex,
    emphasis: cue.emphasis,
    firework,
  };
}

export function buildTemplateReplayCues(
  templateCues: ShowTemplateCue[],
  specifications: FireworkSpecification[],
): ReplayCue[] {
  const specBySlug = new Map(specifications.map((spec) => [spec.slug, spec]));
  const specById = new Map(specifications.map((spec) => [spec.id, spec]));
  return templateCues
    .map((cue, index) => toTemplateReplayCue(cue, index, specBySlug, specById))
    .filter((cue): cue is ReplayCue => Boolean(cue))
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
}

export function getCurrentTemplateReplayCue(
  cues: ReplayCue[],
  elapsedSeconds: number,
): ReplayCue | null {
  if (cues.length === 0) return null;

  const threshold = elapsedSeconds + 0.12;
  let current = cues[0];
  for (const cue of cues) {
    if (cue.timeSeconds > threshold) break;
    current = cue;
  }
  return current;
}
