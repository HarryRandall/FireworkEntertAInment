import { NextResponse } from 'next/server';
import { getAssortmentById } from '@/lib/admin/assortments.server';
import { requirePermission } from '@/lib/admin/current-user.server';
import { getTrustedAppOrigin } from '@/lib/app-origin';
import { renderAssortmentQrSvg } from '@/lib/assortments/qr.server';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requirePermission('admin.manage_assortments'))) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const { id } = await context.params;
  const assortment = await getAssortmentById(id);
  if (!assortment?.publicLink) return NextResponse.json({ ok: false }, { status: 404 });
  const origin = getTrustedAppOrigin();
  if (!origin) {
    return NextResponse.json(
      { ok: false, error: 'APP_ORIGIN is not configured.' },
      { status: 503 },
    );
  }

  const publicUrl = `${origin}/a/${assortment.publicLink.publicToken}`;
  const svg = await renderAssortmentQrSvg(publicUrl);
  const download = new URL(request.url).searchParams.get('download') === '1';
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      ...(download
        ? { 'Content-Disposition': `attachment; filename="assortment-${assortment.id}.svg"` }
        : {}),
    },
  });
}
