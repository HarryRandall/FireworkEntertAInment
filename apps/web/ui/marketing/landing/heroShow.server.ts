/** Loads a published Explore show for the landing hero, built from real catalogue products. */
import 'server-only';

import { unstable_rethrow } from 'next/navigation';
import type { ReplayCue } from '@/lib/show-domain';
import { listReferencedShowTemplateSpecifications } from '@/lib/show-template-specifications.server';
import { getShowTemplateBySlug, listShowTemplates } from '@/lib/show-templates/queries.server';
import { buildTemplateReplayCues } from '@/ui/explore/template-replay-cues';

/** The hero loops this much of the show, in seconds, to keep the first load light. */
const HERO_MAX_SECONDS = 60;
/** Seconds kept after the last cue so its burst finishes before the loop. */
const TAIL_SECONDS = 4;
/** Fewer resolvable cues than this would not read as a show. */
const MIN_CUES = 4;

export type HeroShow = {
  slug: string;
  title: string;
  subtitle: string;
  cues: ReplayCue[];
  duration: number;
};

/**
 * The first featured published show, else the first published one. Returns null when
 * none can be loaded, so the hero can fall back to its built-in demo.
 */
export async function loadHeroShow(): Promise<HeroShow | null> {
  try {
    const summaries = await listShowTemplates();
    const pick = summaries.find((summary) => summary.isFeatured) ?? summaries[0];
    if (!pick) return null;
    const template = await getShowTemplateBySlug(pick.slug);
    if (!template) return null;
    const specifications = await listReferencedShowTemplateSpecifications(template.previewCues);
    const all = buildTemplateReplayCues(template.previewCues, specifications);
    const cues = all.filter((cue) => cue.timeSeconds <= HERO_MAX_SECONDS - TAIL_SECONDS);
    if (cues.length < MIN_CUES) return null;
    const last = cues[cues.length - 1]?.timeSeconds ?? 0;
    return {
      slug: template.slug,
      title: template.title,
      subtitle: `${template.theme} · ${template.effectsCount} effects`,
      cues,
      duration: Math.min(HERO_MAX_SECONDS, last + TAIL_SECONDS),
    };
  } catch (error) {
    // Next signals dynamic rendering by throwing; that must reach the framework.
    unstable_rethrow(error);
    console.error('[landing] hero show could not be loaded:', error);
    return null;
  }
}
