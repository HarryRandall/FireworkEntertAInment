import 'server-only';

import type { ShowTemplateCue } from '@/lib/admin.types';
import type { FireworkSpecification } from '@/lib/show-domain';
import { listFireworkProducts } from '@/lib/shows.server';

const FIREWORK_SLUG_ALIASES: Record<string, string> = {
  chrysanthemum: 'gold-chrysanthemum',
  comet: 'comet-gold',
  finale_barrage: 'white-strobe',
  peony: 'gold-chrysanthemum',
  willow: 'willow-gold',
};

function findLegacySpecification(
  slug: string | undefined,
  specifications: FireworkSpecification[],
  specificationBySlug: Map<string, FireworkSpecification>,
) {
  if (!slug) return undefined;
  return (
    specificationBySlug.get(slug) ??
    specifications.find(
      (specification) =>
        specification.variant?.slug === slug || specification.baseEffect?.slug === slug,
    )
  );
}

function resolveCueSpecification(
  cue: ShowTemplateCue,
  specifications: FireworkSpecification[],
  specificationById: Map<string, FireworkSpecification>,
  specificationBySlug: Map<string, FireworkSpecification>,
) {
  const aliasSlug = cue.fireworkSlug ? FIREWORK_SLUG_ALIASES[cue.fireworkSlug] : undefined;
  return (
    (cue.catalogueItemId ? specificationById.get(cue.catalogueItemId) : undefined) ??
    (cue.catalogueItemSlug ? specificationBySlug.get(cue.catalogueItemSlug) : undefined) ??
    findLegacySpecification(cue.fireworkSlug, specifications, specificationBySlug) ??
    findLegacySpecification(aliasSlug, specifications, specificationBySlug)
  );
}

export function selectReferencedShowTemplateSpecifications(
  cues: ShowTemplateCue[],
  specifications: FireworkSpecification[],
) {
  const specificationById = new Map(
    specifications.map((specification) => [specification.id, specification]),
  );
  const specificationBySlug = new Map(
    specifications.map((specification) => [specification.slug, specification]),
  );
  const referencedIds = new Set<string>();

  for (const cue of cues) {
    const specification = resolveCueSpecification(
      cue,
      specifications,
      specificationById,
      specificationBySlug,
    );
    if (!specification) {
      throw new Error('Published Explore show contains an unresolved preview cue.');
    }
    referencedIds.add(specification.id);
  }

  return specifications.filter((specification) => referencedIds.has(specification.id));
}

export async function listReferencedShowTemplateSpecifications(cues: ShowTemplateCue[]) {
  const specifications = await listFireworkProducts();
  return selectReferencedShowTemplateSpecifications(cues, specifications);
}
