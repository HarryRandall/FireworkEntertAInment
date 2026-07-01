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
): ReplayCue | null {
  const firework =
    specBySlug.get(cue.fireworkSlug) ??
    specBySlug.get(FIREWORK_SLUG_ALIASES[cue.fireworkSlug] ?? '');
  if (!firework) return null;
  return {
    id: `${cue.fireworkSlug}-${cue.timeSeconds}-${index}`,
    position: index + 1,
    timeSeconds: cue.timeSeconds,
    description: cue.description,
    productId: firework.id,
    launchPositionIndex: index % 3,
    firework,
  };
}

export function buildTemplateReplayCues(
  templateCues: ShowTemplateCue[],
  specifications: FireworkSpecification[],
): ReplayCue[] {
  const specBySlug = new Map(specifications.map((spec) => [spec.slug, spec]));
  return templateCues
    .map((cue, index) => toTemplateReplayCue(cue, index, specBySlug))
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
