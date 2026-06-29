'use client';

import { useMemo, useState } from 'react';
import { Check, Settings2 } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PRODUCT_CATALOGUE_FIELD_KEYS, type ProductCatalogueField } from '@/lib/prompt-configs';
import { cn } from '@/lib/utils';

const PRODUCT_FIELD_LABELS: Record<ProductCatalogueField, string> = {
  id: 'ID',
  name: 'Name',
  description: 'Description',
  durationSeconds: 'Duration',
  shotCount: 'Shot count',
  isMultiShot: 'Multi-shot flag',
  heightMeters: 'Height',
  caliber: 'Calibre',
  shellType: 'Shell type',
  color: 'Colour',
  colorPalette: 'Palette',
  effects: 'Effects',
};

const FIELD_HELP: Record<ProductCatalogueField, string> = {
  id: 'Required so generated cues can reference real catalogue products.',
  name: 'Product display name.',
  description: 'Compact product description and intended visual effect.',
  durationSeconds: 'Total product airtime.',
  shotCount: 'Number of shots or bursts.',
  isMultiShot: 'Whether the product occupies its launch tube across multiple shots.',
  heightMeters: 'Approximate visual height.',
  caliber: 'Physical calibre where available.',
  shellType: 'Product shell or effect type.',
  color: 'Primary colour metadata.',
  colorPalette: 'Broader colour palette metadata.',
  effects: 'Active effect flags used for matching musical intent.',
};

type Props = {
  initialFields: readonly ProductCatalogueField[];
};

export function ProductCatalogueFieldsControl({ initialFields }: Props) {
  const [fields, setFields] = useState<ProductCatalogueField[]>(() =>
    PRODUCT_CATALOGUE_FIELD_KEYS.filter((field) => field === 'id' || initialFields.includes(field)),
  );

  const selected = useMemo(() => new Set(fields), [fields]);
  const selectedLabels = fields
    .filter((field) => field !== 'id')
    .map((field) => PRODUCT_FIELD_LABELS[field]);

  function toggleField(field: ProductCatalogueField) {
    if (field === 'id') return;

    setFields((current) => {
      if (current.includes(field)) return current.filter((item) => item !== field);
      return PRODUCT_CATALOGUE_FIELD_KEYS.filter(
        (item) => item === 'id' || current.includes(item) || item === field,
      );
    });
  }

  return (
    <>
      {fields.map((field) => (
        <input key={field} type="hidden" name="productCatalogueFields" value={field} />
      ))}

      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="secondary" className="shrink-0">
            <Settings2 size={16} />
            Configure fields
          </Button>
        </DialogTrigger>
        <DialogContent className="border-border bg-card text-card-foreground max-h-[calc(100dvh-2rem)] overflow-hidden border p-0 duration-[180ms] ease-out sm:max-w-[760px]">
          <DialogHeader className="border-border/50 border-b px-6 pt-6 pb-4">
            <DialogTitle className="text-lg">Catalogue fields</DialogTitle>
            <DialogDescription className="text-muted-foreground max-w-2xl text-sm">
              Choose which catalogue attributes are included in the LLM payload. These fields help
              the model pick products that match timing, colour, duration, and effect intent.
            </DialogDescription>
            <p className="sr-only">
              {selectedLabels.length ? selectedLabels.join(', ') : 'Only product IDs are selected.'}
            </p>
          </DialogHeader>

          <div className="overflow-y-auto px-6 py-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {PRODUCT_CATALOGUE_FIELD_KEYS.map((field) => {
                const locked = field === 'id';
                const checked = selected.has(field);

                return (
                  <button
                    key={field}
                    type="button"
                    disabled={locked}
                    aria-pressed={checked}
                    onClick={() => toggleField(field)}
                    className={cn(
                      'focus-visible:ring-ring/50 flex min-h-20 min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-3',
                      checked
                        ? 'text-foreground border-[color-mix(in_srgb,var(--color-status-success)_40%,var(--border))] bg-[color-mix(in_srgb,var(--color-status-success)_14%,transparent)]'
                        : 'border-border/50 bg-muted text-foreground hover:border-ring hover:text-foreground',
                      locked && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                        checked
                          ? 'border-[color:var(--color-status-success)] bg-[color-mix(in_srgb,var(--color-status-success)_18%,transparent)] text-[color:var(--color-status-success)]'
                          : 'border-border text-transparent',
                      )}
                      aria-hidden
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{PRODUCT_FIELD_LABELS[field]}</span>
                      <span className="text-muted-foreground mt-1 block text-xs leading-relaxed">
                        {FIELD_HELP[field]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
