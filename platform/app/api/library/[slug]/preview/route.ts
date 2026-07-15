import { NextResponse } from 'next/server';
import { getShowTemplateBySlug } from '@/lib/admin/templates.server';
import type { ShowTemplateCue } from '@/lib/admin.types';
import type { FireworkSpecification } from '@/lib/show-domain';
import { listFireworkProducts } from '@/lib/shows.server';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' } as const;
const MAX_SLUG_LENGTH = 180;
const FIREWORK_SLUG_ALIASES: Record<string, string> = {
  chrysanthemum: 'gold-chrysanthemum',
  comet: 'comet-gold',
  finale_barrage: 'white-strobe',
  peony: 'gold-chrysanthemum',
  willow: 'willow-gold',
};

type RouteContext = { params: Promise<{ slug: string }> };

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

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

function selectReferencedSpecifications(
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

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  if (!slug || slug.length > MAX_SLUG_LENGTH) return response({ error: 'not_found' }, 404);

  try {
    const template = await getShowTemplateBySlug(slug);
    if (!template?.isPublished) return response({ error: 'not_found' }, 404);

    const catalogueSpecifications = await listFireworkProducts();
    const specifications = selectReferencedSpecifications(
      template.previewCues,
      catalogueSpecifications,
    );
    return response({ specifications });
  } catch (error) {
    console.error(`[library-preview] ${slug} read failed:`, error);
    return response({ error: 'temporarily_unavailable' }, 503);
  }
}
