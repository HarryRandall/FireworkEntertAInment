'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button } from '@/ui/patterns/Button';
import { EmptyNotice, InlineAlert } from '@/ui/patterns/Feedback';
import type { ComparisonRow } from './types';

const ComparisonPair = dynamic(() => import('./ComparisonPair'), { ssr: false });

/** Mounts at most one pair of canvases; closing or changing a row frees its viewers. */
export function RendererComparison({ rows }: { rows: ComparisonRow[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  if (!rows.length) return <EmptyNotice>No catalogue fireworks found.</EmptyNotice>;
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {rows.length} fireworks. Explicit old overrides are listed for review, including approximate
        trail-colour conversions.
      </p>
      {rows.map((row) => (
        <section key={row.id} className="border-border bg-card space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">{row.name}</h2>
              <p className="text-muted-foreground text-xs">{row.slug}</p>
            </div>
            <Button
              variant="secondary"
              aria-expanded={activeId === row.id}
              aria-controls={`compare-${row.id}`}
              onClick={() => setActiveId(activeId === row.id ? null : row.id)}
            >
              {activeId === row.id ? 'Close comparison' : 'Compare'}
            </Button>
          </div>
          {row.notes.map((note) => (
            <p key={note} className="text-muted-foreground text-sm">
              {note}
            </p>
          ))}
          <details>
            <summary className="cursor-pointer text-sm">
              Unmatched settings ({row.unmatchedSettings.length})
            </summary>
            {row.unmatchedSettings.length ? (
              <ul className="mt-2 space-y-1 text-xs">
                {row.unmatchedSettings.map((setting) => (
                  <li key={setting.path} className="break-words">
                    <code>{setting.path}</code>: {JSON.stringify(setting.value)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">
                No explicit overrides. Template defaults still need visual review against the saved
                old snapshot.
              </p>
            )}
          </details>
          <div id={`compare-${row.id}`}>
            {activeId === row.id &&
              (row.error ? (
                <InlineAlert tone="danger" title={row.error} />
              ) : (
                <ComparisonPair key={row.id} row={row} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
