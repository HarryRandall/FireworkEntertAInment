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

const STATIC_SECONDARY_BUTTON_CLASS =
  '!transition-none hover:!border-[color:var(--color-border-subtle)] hover:!bg-[color:var(--color-bg-default)] hover:!text-[color:var(--color-content-emphasis)] hover:!ring-0 focus:!border-[color:var(--color-border-subtle)] focus:!bg-[color:var(--color-bg-default)] focus:!text-[color:var(--color-content-emphasis)] focus:!ring-0 active:!border-[color:var(--color-border-subtle)] active:!bg-[color:var(--color-bg-default)] active:!text-[color:var(--color-content-emphasis)] active:!ring-0';

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
          <Button
            type="button"
            variant="secondary"
            className={cn('shrink-0', STATIC_SECONDARY_BUTTON_CLASS)}
          >
            <Settings2 size={16} />
            Configure fields
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] p-0 text-[color:var(--color-content-emphasis)] duration-[180ms] ease-out sm:max-w-[760px]">
          <DialogHeader className="border-b border-[color:var(--color-border-subtle)] px-6 pt-6 pb-4">
            <DialogTitle className="text-lg">Catalogue fields</DialogTitle>
            <DialogDescription className="max-w-2xl text-sm text-[color:var(--color-content-subtle)]">
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
                      'flex min-h-20 min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-content-emphasis)]',
                      checked
                        ? 'border-[color-mix(in_srgb,var(--color-status-success)_40%,var(--color-border-default))] bg-[color-mix(in_srgb,var(--color-status-success)_14%,transparent)] text-[color:var(--color-content-emphasis)]'
                        : 'border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] text-[color:var(--color-content-default)] hover:border-[color:var(--color-border-emphasis)] hover:text-[color:var(--color-content-emphasis)]',
                      locked && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                        checked
                          ? 'border-[color:var(--color-status-success)] bg-[color-mix(in_srgb,var(--color-status-success)_18%,transparent)] text-[color:var(--color-status-success)]'
                          : 'border-[color:var(--color-border-default)] text-transparent',
                      )}
                      aria-hidden
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{PRODUCT_FIELD_LABELS[field]}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-[color:var(--color-content-subtle)]">
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
