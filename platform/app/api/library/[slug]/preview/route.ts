import { NextResponse } from 'next/server';
import { getShowTemplateBySlug } from '@/lib/admin/templates.server';
import { listReferencedShowTemplateSpecifications } from '@/lib/show-template-specifications.server';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' } as const;
const MAX_SLUG_LENGTH = 180;

type RouteContext = { params: Promise<{ slug: string }> };

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  if (!slug || slug.length > MAX_SLUG_LENGTH) return response({ error: 'not_found' }, 404);

  try {
    const template = await getShowTemplateBySlug(slug);
    if (!template?.isPublished) return response({ error: 'not_found' }, 404);

    const specifications = await listReferencedShowTemplateSpecifications(template.previewCues);
    return response({ specifications });
  } catch (error) {
    console.error(`[library-preview] ${slug} read failed:`, error);
    return response({ error: 'temporarily_unavailable' }, 503);
  }
}
