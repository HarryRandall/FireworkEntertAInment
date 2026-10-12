'use client';

/** Dialog to create a multishot from a Finale VDL line, or as an empty composition. */
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
} from '@/ui/primitives/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/primitives/tabs';
import { Button } from '@/ui/patterns/Button';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input } from '@/ui/patterns/Input';
import { toast } from '@/ui/patterns/toast';
import { createMultishot } from '../actions';
import { VdlMultishotForm } from './VdlMultishotForm';

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New multishot</DialogTitle>
          <DialogDescription>
            Paste one Finale VDL cake line to build its shots and any missing fireworks, or start
            from an empty timeline.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="vdl" className="gap-4">
          <TabsList>
            <TabsTrigger value="vdl">From Finale VDL</TabsTrigger>
            <TabsTrigger value="empty">Empty</TabsTrigger>
          </TabsList>
          <TabsContent value="vdl">
            <VdlMultishotForm onCancel={() => setOpen(false)} />
          </TabsContent>
          <TabsContent value="empty" className="space-y-4">
            <p className="text-muted-foreground text-sm">
              A multishot places existing fireworks on a timeline. You will add fireworks and their
              firing times after creating it.
            </p>
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
