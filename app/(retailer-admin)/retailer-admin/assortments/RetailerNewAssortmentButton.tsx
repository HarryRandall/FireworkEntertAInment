'use client';

/**
 * Retailer-scoped copy of admin/assortments/NewAssortmentButton — same
 * createAssortment action (gated purely on admin.manage_assortments, no
 * admin.view dependency), just redirecting into /retailer-admin instead of
 * /admin, which a retailer account can't reach. See FIR-166.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/design-system/Button';
import { Field, FieldLabel } from '@/components/design-system/Field';
import { Input } from '@/components/design-system/Input';
import { toast } from '@/components/design-system/toast';
import { createAssortment } from '@/app/actions/admin-assortments';

export function RetailerNewAssortmentButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createAssortment({ name: name.trim() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Assortment created');
      setOpen(false);
      setName('');
      router.push(`/retailer-admin/assortments/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} /> New assortment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New assortment</DialogTitle>
          <DialogDescription>
            A priced bundle of catalogue products. It starts as a $0 draft — set the price and add
            products after creating it, then activate it when it&apos;s ready for shoppers.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="new-assortment-name">Name</FieldLabel>
          <Input
            id="new-assortment-name"
            value={name}
            placeholder="Comet Trail Assortment"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button onClick={create} loading={isPending} disabled={name.trim().length === 0}>
            Create assortment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
