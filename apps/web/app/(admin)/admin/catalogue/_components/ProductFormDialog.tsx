'use client';

/** Client dialog form for editing catalogue metadata (linked rows are never created here). */

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/primitives/dialog';
import { Button } from '@/ui/patterns/Button';
import { Input } from '@/ui/patterns/Input';
import { toast } from '@/ui/patterns/toast';
import {
  FINALE_PRODUCT_ID_MAX_CHARACTERS,
  FINALE_EFFECT_NAME_MAX_CHARACTERS,
} from '@/lib/finale/mapping';
import { updateProduct, type ProductInputType } from '../actions';

type Values = ProductInputType & { id?: string };

type Props = {
  initial?: Values;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
};

export function ProductFormDialog({ initial, open: controlledOpen, onOpenChange, trigger }: Props) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (controlledOpen === undefined) setInternalOpen(v);
  };

  const [finaleProductId, setFinaleProductId] = useState(initial?.finaleProductId ?? '');
  const [finaleEffectName, setFinaleEffectName] = useState(initial?.finaleEffectName ?? '');
  const [partNumber, setPartNumber] = useState(initial?.partNumber ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? '');
  const [fireworkType, setFireworkType] = useState(initial?.fireworkType ?? '');
  const [duration, setDuration] = useState(
    initial?.durationSeconds != null ? String(initial.durationSeconds) : '',
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setFinaleProductId(initial?.finaleProductId ?? '');
      setFinaleEffectName(initial?.finaleEffectName ?? '');
      setPartNumber(initial?.partNumber ?? '');
      setName(initial?.name ?? '');
      setManufacturer(initial?.manufacturer ?? '');
      setFireworkType(initial?.fireworkType ?? '');
      setDuration(initial?.durationSeconds != null ? String(initial.durationSeconds) : '');
    }
  }, [open, initial]);

  const submit = () => {
    startTransition(async () => {
      const values: ProductInputType = {
        finaleProductId,
        finaleEffectName,
        partNumber,
        name,
        manufacturer,
        fireworkType,
        durationSeconds: duration === '' ? null : Number(duration),
      };
      if (!initial?.id) {
        toast.error('Missing catalogue item.');
        return;
      }
      try {
        const result = await updateProduct({ id: initial.id, ...values });
        if (result.ok) {
          toast.success('Catalogue item updated');
          setOpen(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error('The catalogue item could not be saved. Please try again.');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit catalogue item</DialogTitle>
          <DialogDescription>
            Stock metadata only. The firework or multishot itself is edited from its own page.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Part number">
              <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} required />
            </Field>
            <Field label="Duration (s)">
              <Input
                type="number"
                min={0}
                step={0.1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="-"
              />
            </Field>
          </div>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Manufacturer">
              <Input value={manufacturer ?? ''} onChange={(e) => setManufacturer(e.target.value)} />
            </Field>
            <Field label="Type">
              <Input value={fireworkType ?? ''} onChange={(e) => setFireworkType(e.target.value)} />
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Finale 3D product</legend>
            <Field label="Product ID">
              <Input
                value={finaleProductId}
                maxLength={FINALE_PRODUCT_ID_MAX_CHARACTERS}
                onChange={(e) => setFinaleProductId(e.target.value)}
              />
            </Field>
            <Field label="Effect name (optional)">
              <Input
                value={finaleEffectName}
                maxLength={FINALE_EFFECT_NAME_MAX_CHARACTERS}
                onChange={(e) => setFinaleEffectName(e.target.value)}
              />
            </Field>
            <p className="text-muted-foreground text-xs">
              Leave Product ID blank when there is no Finale 3D equivalent.
            </p>
          </fieldset>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
