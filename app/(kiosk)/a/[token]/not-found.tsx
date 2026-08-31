import { PackageX } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

export default function AssortmentUnavailable() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg items-center px-4 py-12 text-center sm:px-6">
      <div className="w-full">
        <span className="bg-surface-container text-on-surface-variant mx-auto flex size-14 items-center justify-center rounded-2xl">
          <PackageX size={26} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Assortment unavailable</h1>
        <p className="text-on-surface-variant mt-2 text-base leading-6">
          This QR code is no longer active. Ask the retailer for the current assortment code.
        </p>
        <Button href="/" variant="secondary" className="mt-6 min-h-11">
          Go to ShowCrafter
        </Button>
      </div>
    </div>
  );
}
