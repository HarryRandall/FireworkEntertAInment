/** Lockable variations: roll candidates from the current design and keep the ones worth comparing. */
'use client';
import { useState } from 'react';
import { Lock, LockOpen, Shuffle } from 'lucide-react';
import type { Design } from '@showcrafter/renderer';
import { rollVariations } from '@/lib/renderer-editor/variations';
import { Button } from '@/ui/patterns/Button';
import { cn } from '@/lib/utils';
import { PosterPreview } from './poster-preview';

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

/** Locks live in the browser only; applying a candidate is one undoable design edit. */
export function VariationsPanel({
  document,
  disabled,
  onChange,
}: {
  document: Design;
  disabled: boolean;
  onChange: (document: Design) => void;
}) {
  const [candidates, setCandidates] = useState<Design[]>([]);
  const [locked, setLocked] = useState<ReadonlySet<number>>(new Set());
  const roll = () => setCandidates(rollVariations(document, candidates, locked, randomSeed()));
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Each roll varies star counts, burst size and trail density around the current design. Lock
        the ones you like, then roll again to replace the rest.
      </p>
      <Button variant="secondary" onClick={roll} disabled={disabled}>
        <Shuffle size={14} />
        {candidates.length === 0 ? 'Roll variations' : 'Roll again'}
      </Button>
      {candidates.length > 0 && (
        <ul className="grid grid-cols-2 gap-2" aria-label="Variations">
          {candidates.map((candidate, index) => {
            const isLocked = locked.has(index);
            return (
              <li
                key={index}
                className={cn(
                  'relative rounded-md border p-1',
                  isLocked ? 'border-primary' : 'border-border',
                )}
              >
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Use variation ${String(index + 1)}`}
                  onClick={() => onChange(structuredClone(candidate))}
                  className="focus-visible:ring-ring block w-full rounded-sm outline-none focus-visible:ring-2 disabled:opacity-50"
                >
                  <PosterPreview document={candidate} />
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-background/80 absolute top-1.5 right-1.5 size-7"
                  aria-label={`Lock variation ${String(index + 1)}`}
                  aria-pressed={isLocked}
                  onClick={() =>
                    setLocked((current) => {
                      const next = new Set(current);
                      if (next.has(index)) next.delete(index);
                      else next.add(index);
                      return next;
                    })
                  }
                >
                  {isLocked ? <Lock size={13} /> : <LockOpen size={13} />}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
