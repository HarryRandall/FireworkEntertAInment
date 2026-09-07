'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/design-system/Button';
import { toast } from '@/components/design-system/toast';

type ShowExportButtonProps = {
  showSlug: string;
  label?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
};

export function ShowExportButton({
  showSlug,
  label = 'Export',
  variant = 'primary',
  size = 'sm',
  className,
  showIcon = false,
}: ShowExportButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false);

  async function downloadExport() {
    if (isPreparing) return;
    setIsPreparing(true);
    try {
      const response = await fetch(`/api/shows/${encodeURIComponent(showSlug)}/export`, {
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const value: unknown = await response.json().catch(() => null);
        const message =
          typeof value === 'object' &&
          value !== null &&
          'error' in value &&
          typeof value.error === 'string'
            ? value.error
            : 'The export could not be prepared.';
        throw new Error(message);
      }

      const blob = await response.blob();
      if (blob.size === 0) throw new Error('The export was empty. Please try again.');
      const filename = exportFilename(
        response.headers.get('Content-Disposition'),
        `${showSlug}-finale-3d.csv`,
      );
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      toast.success('Export ready', { description: filename });
    } catch (error) {
      toast.error('Could not export show', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      loading={isPreparing}
      onClick={() => void downloadExport()}
    >
      {showIcon && !isPreparing ? <Download size={13} aria-hidden="true" /> : null}
      {isPreparing ? 'Preparing export' : label}
    </Button>
  );
}

function exportFilename(header: string | null, fallback: string): string {
  const utf8Name = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedName = header?.match(/filename="([^"]+)"/i)?.[1];
  const plainName = header?.match(/filename=([^;]+)/i)?.[1]?.trim();
  let candidate = utf8Name ?? quotedName ?? plainName ?? fallback;
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // Keep the server-provided name when it is not percent-encoded.
  }
  const safe = candidate.replace(/[\\/\0]/g, '-').trim();
  return safe || fallback;
}
