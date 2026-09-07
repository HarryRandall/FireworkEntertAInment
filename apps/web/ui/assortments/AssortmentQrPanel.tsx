'use client';

import { useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Copy, Download, QrCode } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { Card } from '@/ui/patterns/Card';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input } from '@/ui/patterns/Input';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { toast } from '@/ui/patterns/toast';
import type { AdminAssortmentDetail } from '@/lib/admin/assortments.server';
import { ensureAssortmentPublicLink } from '@/app/actions/admin-assortments';

export function AssortmentQrPanel({
  assortment,
  publicUrl,
}: {
  assortment: AdminAssortmentDetail;
  publicUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function ensureLink() {
    startTransition(async () => {
      try {
        const result = await ensureAssortmentPublicLink(assortment.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('Reusable QR link created');
        router.refresh();
      } catch {
        toast.error('The QR link could not be created. Please try again.');
      }
    });
  }

  async function copyPublicUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Public URL copied');
    } catch {
      toast.error('The public URL could not be copied.');
    }
  }

  return (
    <aside>
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <QrCode className="text-primary" size={20} aria-hidden="true" />
          <h2 className="text-sm font-medium">Reusable QR code</h2>
        </div>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Print this once and reuse it for every copy of the same assortment. Normal assortment
          edits do not change the link.
        </p>

        {!assortment.isActive ? (
          <InlineAlert tone="info" title="This assortment is a draft">
            Activate it in Pack details when it is ready for shoppers.
          </InlineAlert>
        ) : null}
        {!assortment.publicLink ? (
          <Button type="button" className="mt-4 w-full" loading={pending} onClick={ensureLink}>
            Create QR link
          </Button>
        ) : publicUrl ? (
          <>
            <Image
              src={`/api/admin/assortments/${assortment.id}/qr`}
              alt={`QR code for ${assortment.name}`}
              width={512}
              height={512}
              unoptimized
              className="border-border mt-4 aspect-square w-full rounded-xl border bg-white p-2"
            />
            <Field className="mt-4">
              <FieldLabel htmlFor="assortment-public-url">Public URL</FieldLabel>
              <Input
                id="assortment-public-url"
                readOnly
                value={publicUrl}
                className="font-mono text-xs"
              />
            </Field>
            {!assortment.publicLink.isEnabled ? (
              <p className="text-destructive mt-3 text-sm">
                This QR link is disabled. Shoppers cannot use it to create a show.
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={copyPublicUrl}>
                <Copy size={16} aria-hidden="true" />
                Copy URL
              </Button>
              <Button
                href={`/api/admin/assortments/${assortment.id}/qr?download=1`}
                download
                variant="secondary"
              >
                <Download size={16} aria-hidden="true" />
                SVG
              </Button>
            </div>
          </>
        ) : (
          <p className="text-destructive mt-4 text-sm">
            The public link is unavailable. Contact your administrator to finish setting up sharing.
          </p>
        )}
      </Card>
    </aside>
  );
}
