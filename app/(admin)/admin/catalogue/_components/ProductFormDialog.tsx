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
} from '@/components/ui/dialog';
import { Button } from '@/components/design-system/Button';
import { Input } from '@/components/design-system/Input';
import { toast } from '@/components/design-system/toast';
import { updateProduct, type ProductInputType } from '@/app/actions/admin-catalogue';

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
      const result = await updateProduct({ id: initial.id, ...values });
      if (result.ok) {
        toast.success('Catalogue item updated');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
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
                placeholder="—"
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

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
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
      <span className="text-xs font-medium text-[color:var(--color-content-subtle)]">{label}</span>
      {children}
    </label>
  );
}
