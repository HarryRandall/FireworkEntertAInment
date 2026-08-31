'use client';

/** Dialog to create a new, empty multishot composition. */
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
import { createMultishot } from '@/app/actions/admin-multishots';

export function NewMultishotButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createMultishot({ name: name.trim() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Multishot created');
      setOpen(false);
      setName('');
      router.push(`/admin/multishots/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} /> New multishot
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New multishot</DialogTitle>
          <DialogDescription>
            A multishot places existing fireworks on a timeline. You will add fireworks and their
            firing times after creating it.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="new-ms-name">Name</FieldLabel>
          <Input
            id="new-ms-name"
            value={name}
            placeholder="Finale Barrage"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button onClick={create} loading={isPending} disabled={name.trim().length === 0}>
            Create multishot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
