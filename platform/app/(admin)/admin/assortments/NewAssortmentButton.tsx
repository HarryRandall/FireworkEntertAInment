'use client';

/** Dialog to create a new, empty (draft, $0) assortment. */
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
import { Button } from '@/app/components/ui/Button';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { Input } from '@/app/components/ui/Input';
import { toast } from '@/app/components/ui/toast';
import { createAssortment } from '@/app/actions/admin-assortments';

export function NewAssortmentButton() {
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
      router.push(`/admin/assortments/${result.id}`);
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
