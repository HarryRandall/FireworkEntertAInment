'use client';

/** Dialog to create a new atomic firework on a chosen base effect. */
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
import { SelectField } from '@/app/components/ui/SelectField';
import { toast } from '@/app/components/ui/toast';
import { createFirework } from '@/app/actions/admin-fireworks';
import type { AdminEffectOption } from '@/lib/admin.types';

export function NewFireworkButton({ effects }: { effects: AdminEffectOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [effectId, setEffectId] = useState(effects[0]?.id ?? '');
  const [isPending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createFirework({ name: name.trim(), effectId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Firework created');
      setOpen(false);
      setName('');
      router.push(`/admin/fireworks/${result.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus size={16} /> New firework
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New firework</DialogTitle>
          <DialogDescription>
            Pick a base effect to start from. You can customise colours and every renderer detail
            afterwards.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="new-fw-name">Name</FieldLabel>
            <Input
              id="new-fw-name"
              value={name}
              placeholder="Gold Peony 75mm"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>Base effect</FieldLabel>
            <SelectField
              value={effectId}
              onChange={setEffectId}
              options={effects.map((effect) => ({
                value: effect.id,
                label: effect.name,
                description: effect.family,
              }))}
              ariaLabel="Base effect"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            onClick={create}
            loading={isPending}
            disabled={name.trim().length === 0 || !effectId}
          >
            Create firework
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
