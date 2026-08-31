'use client';

/**
 * Simulated "generate a show" preview so a retailer can sanity-check an
 * assortment before it goes live. Entirely client-side and fabricated —
 * does not call createShowAction, spend credits, or touch cue generation
 * (see platform/app/(app)/shows/new/actions.ts for the real flow). See FIR-166.
 *
 * TODO(FIR-168): this simulator is a placeholder. Once the in-store QR flow
 * ships (companion consumer mockup: showcrafter-instore-mockup.html), this
 * should link straight to the same assortment-scoped deep link a shopper
 * lands on after scanning the QR code at the shelf, so "test" means "see
 * exactly what the customer sees" rather than a fabricated result.
 */

import { useState } from 'react';
import { PlayCircle, RotateCcw } from 'lucide-react';
import { Button, Card, StatTile } from '@/app/components/ui';
import { cn } from '@/lib/utils';
import type { RetailerAssortment } from '../_lib/assortments.server';

type SimulatedResult = {
  cueCount: number;
  durationSeconds: number;
  credits: number;
};

function simulateResult(assortment: RetailerAssortment): SimulatedResult {
  const cueCount = Math.max(6, assortment.items.length * 4);
  return {
    cueCount,
    durationSeconds: Math.round(cueCount * 2.4),
    credits: Math.max(2, Math.round(cueCount * 0.6)),
  };
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

export function TestShowSimulator({ assortments }: { assortments: RetailerAssortment[] }) {
  const [selectedId, setSelectedId] = useState(assortments[0]?.id ?? '');
  const [status, setStatus] = useState<'idle' | 'generating' | 'done'>('idle');
  const [result, setResult] = useState<SimulatedResult | null>(null);

  const selected = assortments.find((assortment) => assortment.id === selectedId) ?? null;

  function generate() {
    if (!selected) return;
    setStatus('generating');
    setResult(null);
    window.setTimeout(() => {
      setResult(simulateResult(selected));
      setStatus('done');
    }, 900);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {assortments.map((assortment) => {
          const active = assortment.id === selectedId;
          return (
            <Card
              key={assortment.id}
              role="radio"
              tabIndex={0}
              aria-checked={active}
              onClick={() => {
                setSelectedId(assortment.id);
                setStatus('idle');
                setResult(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedId(assortment.id);
                  setStatus('idle');
                  setResult(null);
                }
              }}
              className={cn(
                'focus-visible:ring-ring/50 cursor-pointer p-4 transition-colors focus:outline-none focus-visible:ring-3',
                active ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground text-sm font-medium">{assortment.name}</span>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  ${(assortment.priceCents / 100).toFixed(2)}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {assortment.items.length} product{assortment.items.length === 1 ? '' : 's'}
              </p>
            </Card>
          );
        })}
      </div>

      <div>
        <Button onClick={generate} disabled={!selected || status === 'generating'}>
          <PlayCircle size={16} />
          {status === 'generating' ? 'Generating test show…' : 'Generate test show'}
        </Button>
      </div>

      {status === 'done' && result ? (
        <Card className="p-5" shadow>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-foreground text-sm font-semibold">
              Simulated result · {selected?.name}
            </h3>
            <button
              type="button"
              onClick={() => {
                setStatus('idle');
                setResult(null);
              }}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Cues" value={result.cueCount} />
            <StatTile label="Duration" value={formatDuration(result.durationSeconds)} />
            <StatTile label="Credits used" value={result.credits} unit="simulated" />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
