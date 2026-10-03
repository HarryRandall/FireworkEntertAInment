import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { ok: true, message: 'ShowCrafter rebuild is running.' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
