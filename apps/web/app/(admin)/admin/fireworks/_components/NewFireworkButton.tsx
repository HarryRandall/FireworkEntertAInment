'use client';

/** Dialog to create a new atomic firework on a chosen base effect. */
import { Button } from '@/ui/patterns/Button';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input } from '@/ui/patterns/Input';
import { SelectField } from '@/ui/patterns/SelectField';
import { toast } from '@/ui/patterns/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/primitives/dialog';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createFireworkFromTemplate } from '../template-actions';
import { effectTemplates } from '@showcrafter/renderer';

/** Creates a catalogue firework from any built-in renderer template. */
export function NewFireworkButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [effectId, setEffectId] = useState<string>(effectTemplates[0].key);
  const [isPending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof createFireworkFromTemplate>>;
      try {
        result = await createFireworkFromTemplate({ name: name.trim(), templateKey: effectId });
      } catch {
        toast.error('Could not create the firework. Try again.');
        return;
      }
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
          <Plus size={16} /> New firework from template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New firework from template</DialogTitle>
          <DialogDescription>
            Pick a renderer template to start from. You can customise colours and every renderer
            detail afterwards.
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
            <FieldLabel>Template</FieldLabel>
            <SelectField
              value={effectId}
              onChange={setEffectId}
              options={effectTemplates.map((effect) => ({
                value: effect.key,
                label: effect.name,
              }))}
              ariaLabel="Template"
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
