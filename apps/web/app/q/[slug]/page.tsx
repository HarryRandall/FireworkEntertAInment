/** Permanent QR entry resolves public targets and preserves useful store recovery links. */
import { redirect } from 'next/navigation';
import { readQr } from '@/lib/shopper/readers';
import { scannedDestination } from '@/lib/shopper/paths';
import { QrRecovery, QrStoreChoices, QrLanding } from '@/ui/shopper/qr-recovery';

/** Resolves a code or presents the resolver's authorised store choices and recovery path. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await readQr(slug);
  if (!result)
    return (
      <QrLanding title="This code is unavailable">
        <QrRecovery />
      </QrLanding>
    );
  if ('pick_store' in result)
    return (
      <QrLanding title="Choose your shop">
        <QrStoreChoices stores={result.stores} qr={result.qr_id} />
      </QrLanding>
    );
  if (result.fallback)
    return (
      <QrLanding title="This code is unavailable">
        <QrRecovery slug={result.store_slug} />
      </QrLanding>
    );
  redirect(
    scannedDestination(result.store_slug, result.target_type, result.target_id, result.qr_id),
  );
}
