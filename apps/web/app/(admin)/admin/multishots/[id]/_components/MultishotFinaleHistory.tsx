'use client';

import { useState } from 'react';
import { Button } from '@/ui/patterns/Button';
import { InlineAlert } from '@/ui/patterns/Feedback';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/ui/primitives/dialog';
import type { CakeEffect } from '@/lib/finale/document';
import { readMultishotFinaleHistory, type CompositionHistoryEntry } from '../../finale-actions';

/** Displays stored before/after import snapshots without altering the current composition. */
export function MultishotFinaleHistory({ id, effects }: { id: string; effects: CakeEffect[] }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<CompositionHistoryEntry[]>([]);
  async function load() {
    setOpen(true);
    setPending(true);
    setError(null);
    try {
      const result = await readMultishotFinaleHistory(id);
      if (result.ok) setEntries(result.entries);
      else setError(result.error);
    } catch {
      setError('Import history could not be loaded.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button variant="ghost" loading={pending} onClick={() => void load()}>
        Import history
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import history</DialogTitle>
            <DialogDescription>
              The five most recent saved imports, including the shots they replaced.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <InlineAlert tone="danger" title="History unavailable">
              {error}
            </InlineAlert>
          ) : null}
          {!pending && !error && entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No saved imports yet.</p>
          ) : null}
          <div className="max-h-96 space-y-3 overflow-auto text-sm">
            {entries.map((entry) => (
              <details key={entry.id}>
                <summary>
                  {new Date(entry.createdAt).toLocaleString('en-GB')} ({entry.before.length} to{' '}
                  {entry.after.length} shots)
                </summary>
                {(['before', 'after'] as const).map((phase) => (
                  <div key={phase} className="mt-2">
                    <h3 className="font-medium">
                      {phase === 'before' ? 'Before import' : 'After import'}
                    </h3>
                    <ul>
                      {entry[phase].map((shot, index) => (
                        <li key={index}>
                          {shot.time_offset_seconds}s:{' '}
                          {effects.find((effect) => effect.id === shot.firework_id)?.name ??
                            shot.firework_id}
                          , pan {shot.pan_degrees}, tilt {shot.tilt_degrees}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </details>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
