/** Variation locks are browser choices; applying a candidate is one document edit. */
'use client';
import { Lock, Unlock, Sparkles } from 'lucide-react';
import { useState, type Dispatch } from 'react';
import type { Design } from '@showcrafter/fireworks';
import { rollVariations } from '@/lib/studio/variations';
import type { StudioEdit } from '@/lib/studio/document';
import { Button } from '@/ui/primitives/button';
import { StudioPoster } from './studio-poster';

/** Keeps locked snapshots through rerolls of the current design without writing them to draft history. */
export function StudioVariations({
  document,
  editable,
  dispatch,
}: {
  document: Design;
  editable: boolean;
  dispatch: Dispatch<StudioEdit>;
}) {
  const [candidates, setCandidates] = useState(() =>
    rollVariations(document, [], new Set(), document.seed),
  );
  const [locked, setLocked] = useState(new Set<number>());
  return (
    <section
      aria-label="Variations"
      className="sc-studio-variations bg-stage text-stage-foreground"
    >
      <div>
        <h2 className="font-semibold">Variations</h2>
        <p className="text-muted-foreground text-xs">Lock the ones you like, then roll again</p>
      </div>
      <div className="sc-studio-variation-grid">
        {candidates.map((candidate, index) => (
          <div
            key={index}
            data-variation={index + 1}
            data-seed={candidate.seed}
            className="sc-studio-variation min-w-0"
          >
            <Button
              className="sc-studio-variation-apply"
              variant="outline"
              aria-label={`Apply variation ${String(index + 1)}`}
              disabled={!editable}
              onClick={() => {
                dispatch({ type: 'commit' });
                dispatch({ type: 'replace', document: structuredClone(candidate) });
              }}
            >
              <StudioPoster document={candidate} />
            </Button>
            <Button
              className="sc-studio-variation-lock"
              size="icon-sm"
              variant="ghost"
              aria-label={`Lock variation ${String(index + 1)}`}
              aria-pressed={locked.has(index)}
              onClick={() => {
                setLocked((previous) => {
                  const next = new Set(previous);
                  if (next.has(index)) next.delete(index);
                  else next.add(index);
                  return next;
                });
              }}
            >
              {locked.has(index) ? <Lock /> : <Unlock />}
            </Button>
          </div>
        ))}
      </div>
      <Button
        aria-label="Roll again"
        variant="outline"
        onClick={() => {
          setCandidates(
            rollVariations(
              document,
              candidates,
              locked,
              crypto.getRandomValues(new Uint32Array(1))[0],
            ),
          );
        }}
      >
        <Sparkles /> Roll
      </Button>
    </section>
  );
}
