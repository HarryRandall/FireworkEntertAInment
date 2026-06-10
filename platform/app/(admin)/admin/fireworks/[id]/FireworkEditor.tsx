'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Trash2 } from 'lucide-react';
import {
  deleteProductShot,
  updateFireworkProduct,
  upsertProductShot,
} from '@/app/actions/admin-fireworks';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import {
  DataTableShell,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableRowClasses,
} from '@/app/components/ui/DataTable';
import { Field, FieldError, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert } from '@/app/components/ui/Feedback';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { toast } from '@/app/components/ui/toast';
import type { AdminFireworkDetail, AdminFireworkShot } from '@/lib/admin.types';

const PRODUCT_KIND_OPTIONS = [
  { value: 'single_shot', label: 'Single shot' },
  { value: 'multi_shot', label: 'Multi-shot' },
  { value: 'assortment', label: 'Assortment' },
  { value: 'cake', label: 'Cake' },
  { value: 'rack', label: 'Rack' },
  { value: 'shell_kit', label: 'Shell kit' },
  { value: 'fountain', label: 'Fountain' },
  { value: 'other', label: 'Other' },
] satisfies Array<{ value: ProductKind; label: string }>;

type ProductKind =
  | 'single_shot'
  | 'multi_shot'
  | 'assortment'
  | 'cake'
  | 'rack'
  | 'shell_kit'
  | 'fountain'
  | 'other';

type ProductDraft = {
  partNumber: string;
  name: string;
  manufacturer: string;
  fireworkType: string;
  productKind: ProductKind;
  durationSeconds: string;
  description: string;
};

type ShotDraft = {
  id?: string;
  variantId: string;
  shotIndex: string;
  timeOffsetSeconds: string;
  panDegrees: string;
  tiltDegrees: string;
  caliber: string;
  notes: string;
};

function swatch(color: string | null) {
  if (!color) return null;
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border border-[color:var(--color-border-subtle)]"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function productKindFromValue(value: string): ProductKind {
  return PRODUCT_KIND_OPTIONS.some((option) => option.value === value)
    ? (value as ProductKind)
    : 'other';
}

function shotToDraft(shot: AdminFireworkShot): ShotDraft {
  return {
    id: shot.id,
    variantId: shot.variantId ?? '',
    shotIndex: String(shot.shotIndex),
    timeOffsetSeconds: String(shot.timeOffsetSeconds),
    panDegrees: String(shot.panDegrees),
    tiltDegrees: String(shot.tiltDegrees),
    caliber: shot.caliber ?? '',
    notes: shot.notes ?? '',
  };
}

export function FireworkEditor({ firework }: { firework: AdminFireworkDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductDraft>({
    partNumber: firework.partNumber,
    name: firework.name,
    manufacturer: firework.manufacturer ?? '',
    fireworkType: firework.fireworkType ?? '',
    productKind: productKindFromValue(firework.productKind),
    durationSeconds: firework.durationSeconds == null ? '' : String(firework.durationSeconds),
    description: firework.description ?? '',
  });

  const variantOptions = useMemo(
    () =>
      firework.variantOptions.map((variant) => ({
        value: variant.id,
        label: variant.name,
        description: `${variant.baseEffectName}${variant.primaryColor ? ` · ${variant.primaryColor}` : ''}`,
      })),
    [firework.variantOptions],
  );

  const nextShotIndex = firework.shots.length
    ? Math.max(...firework.shots.map((shot) => shot.shotIndex)) + 1
    : 1;

  function saveProduct() {
    setError(null);
    startTransition(async () => {
      const result = await updateFireworkProduct({
        id: firework.id,
        partNumber: product.partNumber,
        name: product.name,
        manufacturer: product.manufacturer,
        fireworkType: product.fireworkType,
        productKind: product.productKind,
        durationSeconds: product.durationSeconds === '' ? null : Number(product.durationSeconds),
        description: product.description,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Firework product saved');
      router.refresh();
    });
  }

  return (
    <div className="grid min-h-0 gap-8 xl:grid-cols-[minmax(0,420px)_1fr]">
      <section className="space-y-5 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-5">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--color-content-emphasis)]">
            Product
          </h2>
          <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">
            Product identity, supplier details, and sale catalogue metadata.
          </p>
        </div>

        {error ? (
          <InlineAlert tone="danger" title="Could not save">
            {error}
          </InlineAlert>
        ) : null}

        <div className="grid gap-4">
          <Field>
            <FieldLabel htmlFor="firework-name">Name</FieldLabel>
            <Input
              id="firework-name"
              value={product.name}
              onChange={(event) => setProduct((draft) => ({ ...draft, name: event.target.value }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="firework-part-number">Part number</FieldLabel>
              <Input
                id="firework-part-number"
                value={product.partNumber}
                onChange={(event) =>
                  setProduct((draft) => ({ ...draft, partNumber: event.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel>Product kind</FieldLabel>
              <SelectField
                value={product.productKind}
                onChange={(value) =>
                  setProduct((draft) => ({ ...draft, productKind: productKindFromValue(value) }))
                }
                options={PRODUCT_KIND_OPTIONS}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="firework-manufacturer">Manufacturer</FieldLabel>
              <Input
                id="firework-manufacturer"
                value={product.manufacturer}
                onChange={(event) =>
                  setProduct((draft) => ({ ...draft, manufacturer: event.target.value }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="firework-type">Type label</FieldLabel>
              <Input
                id="firework-type"
                value={product.fireworkType}
                onChange={(event) =>
                  setProduct((draft) => ({ ...draft, fireworkType: event.target.value }))
                }
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="firework-duration">Duration seconds</FieldLabel>
            <Input
              id="firework-duration"
              inputMode="decimal"
              value={product.durationSeconds}
              onChange={(event) =>
                setProduct((draft) => ({ ...draft, durationSeconds: event.target.value }))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="firework-description">Description</FieldLabel>
            <Textarea
              id="firework-description"
              rows={5}
              value={product.description}
              onChange={(event) =>
                setProduct((draft) => ({ ...draft, description: event.target.value }))
              }
            />
          </Field>
        </div>

        <Button onClick={saveProduct} loading={isPending} className="w-full">
          <Save size={16} />
          Save product
        </Button>
      </section>

      <section className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--color-content-emphasis)]">
              Shot Sequence
            </h2>
            <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">
              Timed launch sequence for this sold product.
            </p>
          </div>
          <Badge tone="accent" solid>
            {firework.shots.length} shots
          </Badge>
        </div>

        <DataTableShell viewport>
          <table className={tableClasses('min-w-[1180px]')}>
            <thead className={tableHeadClasses()}>
              <tr>
                <th className={tableHeaderCellClasses()}>#</th>
                <th className={tableHeaderCellClasses()}>Variant</th>
                <th className={tableHeaderCellClasses()}>Time</th>
                <th className={tableHeaderCellClasses()}>Pan</th>
                <th className={tableHeaderCellClasses()}>Tilt</th>
                <th className={tableHeaderCellClasses()}>Calibre</th>
                <th className={tableHeaderCellClasses()}>Notes</th>
                <th className={tableHeaderCellClasses('text-right')}>Save</th>
              </tr>
            </thead>
            <tbody>
              {firework.shots.map((shot) => (
                <ShotRowEditor
                  key={shot.id}
                  productId={firework.id}
                  initial={shotToDraft(shot)}
                  variantOptions={variantOptions}
                  variants={firework.variantOptions}
                />
              ))}
              <ShotRowEditor
                productId={firework.id}
                initial={{
                  variantId: firework.variantOptions[0]?.id ?? '',
                  shotIndex: String(nextShotIndex),
                  timeOffsetSeconds: firework.durationSeconds
                    ? String(Math.max(0, Math.floor(firework.durationSeconds)))
                    : '0',
                  panDegrees: '0',
                  tiltDegrees: '0',
                  caliber: firework.shots[0]?.caliber ?? '',
                  notes: '',
                }}
                variantOptions={variantOptions}
                variants={firework.variantOptions}
                isNew
              />
            </tbody>
          </table>
        </DataTableShell>
      </section>
    </div>
  );
}

function ShotRowEditor({
  productId,
  initial,
  variantOptions,
  variants,
  isNew = false,
}: {
  productId: string;
  initial: ShotDraft;
  variantOptions: { value: string; label: string; description?: string }[];
  variants: AdminFireworkDetail['variantOptions'];
  isNew?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const selectedVariant = variants.find((variant) => variant.id === draft.variantId);

  function saveShot() {
    setError(null);
    startTransition(async () => {
      const result = await upsertProductShot({
        id: draft.id,
        productId,
        variantId: draft.variantId,
        shotIndex: Number(draft.shotIndex),
        timeOffsetSeconds: Number(draft.timeOffsetSeconds),
        panDegrees: Number(draft.panDegrees),
        tiltDegrees: Number(draft.tiltDegrees),
        caliber: draft.caliber,
        notes: draft.notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isNew ? 'Shot added' : 'Shot saved');
      router.refresh();
    });
  }

  function removeShot() {
    if (!draft.id) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProductShot({ id: draft.id!, productId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Shot deleted');
      router.refresh();
    });
  }

  return (
    <tr className={tableRowClasses()}>
      <td className={tableCellClasses('align-top')}>
        <Input
          aria-label="Shot index"
          className="w-20 font-mono tabular-nums"
          inputMode="numeric"
          value={draft.shotIndex}
          onChange={(event) => setDraft((next) => ({ ...next, shotIndex: event.target.value }))}
        />
      </td>
      <td className={tableCellClasses('align-top')}>
        <div className="min-w-72 space-y-2">
          <SelectField
            ariaLabel="Firework variant"
            value={draft.variantId}
            onChange={(value) => setDraft((next) => ({ ...next, variantId: value }))}
            options={variantOptions}
            disabled={variantOptions.length === 0}
          />
          <div className="flex items-center gap-2 text-xs text-[color:var(--color-content-subtle)]">
            {swatch(selectedVariant?.primaryColor ?? null)}
            <span>{selectedVariant?.baseEffectName ?? 'No variant selected'}</span>
          </div>
          <FieldError>{error}</FieldError>
        </div>
      </td>
      <td className={tableCellClasses('align-top')}>
        <Input
          aria-label="Time offset seconds"
          className="w-24 font-mono tabular-nums"
          inputMode="decimal"
          value={draft.timeOffsetSeconds}
          onChange={(event) =>
            setDraft((next) => ({ ...next, timeOffsetSeconds: event.target.value }))
          }
        />
      </td>
      <td className={tableCellClasses('align-top')}>
        <Input
          aria-label="Pan degrees"
          className="w-20 font-mono tabular-nums"
          inputMode="numeric"
          value={draft.panDegrees}
          onChange={(event) => setDraft((next) => ({ ...next, panDegrees: event.target.value }))}
        />
      </td>
      <td className={tableCellClasses('align-top')}>
        <Input
          aria-label="Tilt degrees"
          className="w-20 font-mono tabular-nums"
          inputMode="numeric"
          value={draft.tiltDegrees}
          onChange={(event) => setDraft((next) => ({ ...next, tiltDegrees: event.target.value }))}
        />
      </td>
      <td className={tableCellClasses('align-top')}>
        <Input
          aria-label="Calibre"
          className="w-24"
          placeholder="30mm"
          value={draft.caliber}
          onChange={(event) => setDraft((next) => ({ ...next, caliber: event.target.value }))}
        />
      </td>
      <td className={tableCellClasses('align-top')}>
        <div className="min-w-56">
          <Input
            aria-label="Shot notes"
            value={draft.notes}
            onChange={(event) => setDraft((next) => ({ ...next, notes: event.target.value }))}
          />
        </div>
      </td>
      <td className={tableCellClasses('text-right align-top')}>
        <div className="flex justify-end gap-2">
          <Button
            size="icon"
            variant={isNew ? 'accent' : 'secondary'}
            loading={isPending}
            onClick={saveShot}
            aria-label={isNew ? 'Add shot' : 'Save shot'}
            disabled={!draft.variantId}
          >
            {isNew ? <Plus size={16} /> : <Save size={16} />}
          </Button>
          {!isNew ? (
            <Button
              size="icon"
              variant="destructive"
              loading={isPending}
              onClick={removeShot}
              aria-label="Delete shot"
            >
              <Trash2 size={16} />
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
