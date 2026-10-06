'use client';

import { MultishotFinaleHistory } from './MultishotFinaleHistory';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/patterns/Button';
import { Textarea } from '@/ui/patterns/Input';
import { InlineAlert } from '@/ui/patterns/Feedback';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ui/primitives/dialog';
import { toast } from '@/ui/patterns/toast';
import {
  exportMultishotCake,
  importedMultishotShots,
  type MultishotFinaleShot,
} from '@/lib/finale/multishot';
import type { CakeEffect } from '@/lib/finale/document';
import {
  previewMultishotFinaleImport,
  importMultishotFinale,
  type SavedCompositionShot,
} from '../../finale-actions';

type Preview = Extract<
  Awaited<ReturnType<typeof previewMultishotFinaleImport>>,
  { kind: 'preview' }
>;

/** Exact cake downloads and non-destructive import previews for the current editor composition. */
export function MultishotFinaleActions({
  id,
  shots,
  effects,
  prepare,
  importDisabled,
  onImported,
}: {
  id: string;
  shots: MultishotFinaleShot[];
  effects: CakeEffect[];
  prepare: () => Promise<{ ok: true } | { ok: false; error: string }>;
  importDisabled: boolean;
  onImported: (shots: SavedCompositionShot[], durationSeconds: number | null) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const converted = preview ? importedMultishotShots(preview.tubes) : null;

  function download() {
    const result = exportMultishotCake(shots, effects, '');
    if (result.kind === 'error') {
      toast.error(result.message);
      return;
    }
    const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'multishot-finale.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function previewImport() {
    setPending(true);
    setError(null);
    setPreview(null);
    try {
      const prepared = await prepare();
      if (!prepared.ok) {
        setError(prepared.error);
        return;
      }
      const result = await previewMultishotFinaleImport(text, id);
      if (result.kind === 'error') setError(result.message);
      else setPreview(result);
    } catch {
      setError('The import could not be previewed. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function saveImport() {
    if (!preview || converted?.kind !== 'shots') return;
    setPending(true);
    setError(null);
    try {
      const result = await importMultishotFinale({
        id,
        text,
        expectedUpdatedAt: preview.expectedUpdatedAt,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onImported(result.shots, result.durationSeconds);
      setOpen(false);
      toast.success('Multishot shots imported');
      router.refresh();
    } catch {
      setError('The import could not be saved. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={download}>
        Export Finale cake
      </Button>
      <Button variant="secondary" disabled={importDisabled} onClick={() => setOpen(true)}>
        Import Finale cake
      </Button>
      <MultishotFinaleHistory id={id} effects={effects} />
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Finale cake</DialogTitle>
            <DialogDescription>
              Preview one exact cake description or CSV row. Saving replaces the current shots and
              records their history.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm">
            Cake syntax
            <Textarea
              value={text}
              disabled={pending}
              onChange={(event) => {
                setText(event.target.value);
                setPreview(null);
                setError(null);
              }}
            />
          </label>
          {error ? (
            <InlineAlert tone="danger" title="Import could not complete">
              {error}
            </InlineAlert>
          ) : null}
          {converted?.kind === 'error' ? (
            <InlineAlert tone="warning" title="Cannot save this preview">
              {converted.message}
            </InlineAlert>
          ) : null}
          {preview ? (
            <ul className="max-h-64 overflow-auto text-sm">
              {preview.tubes.map((tube) => (
                <li key={tube.id} className={tube.problem ? 'text-status-warning' : ''}>
                  {tube.timeMs} ms, {tube.angleDeg} degrees: {tube.name}
                  {tube.problem ? ` (${tube.problem})` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" loading={pending} onClick={() => void previewImport()}>
              Preview import
            </Button>
            <Button
              disabled={!preview || converted?.kind !== 'shots' || pending}
              onClick={() => void saveImport()}
            >
              {shots.length ? 'Replace shots' : 'Create shots'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
