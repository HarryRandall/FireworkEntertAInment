import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ImportRenderHarness } from './ImportRenderHarness';
import { isAuthorisedImportRenderRequest } from '@/lib/import-render-auth.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Engine validation',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

export default async function ImportRenderPage({ searchParams }: { searchParams: SearchParams }) {
  const values = await searchParams;
  const runId = single(values.runId);
  const expires = single(values.expires);
  const nonce = single(values.nonce);
  const signature = single(values.signature);
  const expiresAt = expires ? Number(expires) : Number.NaN;
  if (
    !runId ||
    !nonce ||
    !signature ||
    !Number.isInteger(expiresAt) ||
    !isAuthorisedImportRenderRequest({ runId, expiresAt, nonce }, signature)
  ) {
    notFound();
  }

  return <ImportRenderHarness />;
}
